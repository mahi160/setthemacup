#!/bin/bash

DOTFILES_DIR="dotfiles"

# Function to log actions to a file
log_action() {
  local message="$1"
  local log_file="$HOME/setup.log"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >>"$log_file" 2>/dev/null || {
    echo -e "\033[31mError: Failed to write to log file '$log_file'.\033[0m"
  }
}

# Function to send desktop notifications
notify() {
  local message="$1"
  local expire_time="${2:-10000}" # Default to 10 seconds
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "$message" --expire-time="$expire_time" || {
      echo -e "\033[31mError: Failed to send notification.\033[0m"
    }
  else
    echo -e "\033[33mWarning: notify-send not installed, skipping notification.\033[0m"
  fi
  log_action "$message"
}

# Function to install Homebrew
set_homebrew() {
  echo -e "\033[34mInstalling Homebrew...\033[0m"
  if ! command -v brew >/dev/null 2>&1; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
      echo -e "\033[31mError: Homebrew installation failed.\033[0m"
      log_action "Homebrew installation failed"
      return 1
    }
    echo >>/Users/mahi/.zprofile
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>/Users/mahi/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
    notify "Homebrew installed successfully"
  else
    echo -e "\033[32mHomebrew already installed.\033[0m"
    notify "Homebrew already installed"
  fi
}

# Function to install applications via Homebrew
set_apps() {
  echo -e "\033[34mInstalling applications via Homebrew...\033[0m"
  if ! command -v brew >/dev/null 2>&1; then
    echo -e "\033[31mError: Homebrew not installed. Run set_homebrew first.\033[0m"
    log_action "Homebrew not installed for set_apps"
    return 1
  fi

  local apps=(
    zsh stow neovim git fastfetch tree-sitter ripgrep caffeine zen
    tailscale vlc qbittorrent alt-tab lazygit shottr mos starship
    slack whatsapp fzf tmux fnm raycast rectangle ghostty thefuck eza
  )

  for app in "${apps[@]}"; do
    echo -e "\033[34mInstalling $app...\033[0m"
    brew install "$app" || {
      echo -e "\033[31mWarning: Failed to install $app.\033[0m"
      log_action "Failed to install $app"
    }
  done
  notify "Application installation complete"
}

# Function to set up dotfiles and Zsh configuration
set_dotfiles() {
  echo -e "\033[34mSetting up dotfiles and Zsh...\033[0m"

  # Install oh-my-zsh
  if [[ ! -d ~/.oh-my-zsh ]]; then
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended || {
      echo -e "\033[31mError: Failed to install oh-my-zsh.\033[0m"
      log_action "oh-my-zsh installation failed"
      return 1
    }
  else
    echo -e "\033[32moh-my-zsh already installed.\033[0m"
  fi

  # Set zsh as default shell
  if [[ "$(dscl . -read /Users/$USER UserShell | awk '{print $2}')" != "$(which zsh)" ]]; then
    chsh -s "$(which zsh)" "$USER" || {
      echo -e "\033[31mError: Failed to set zsh as default shell.\033[0m"
      log_action "Failed to set zsh as default shell"
      return 1
    }
  else
    echo -e "\033[32mzsh already set as default shell.\033[0m"
  fi

  # Install zsh plugins
  local zsh_custom=${ZSH_CUSTOM:-~/.oh-my-zsh/custom}
  local plugins=(
    "zsh-users/zsh-autosuggestions"
    "zsh-users/zsh-syntax-highlighting"
  )

  for plugin in "${plugins[@]}"; do
    local dest="$zsh_custom/plugins/${plugin##*/}"
    if [[ ! -d "$dest" ]]; then
      git clone "https://github.com/$plugin" "$dest" || {
        echo -e "\033[31mWarning: Failed to clone $plugin.\033[0m"
        log_action "Failed to clone $plugin"
      }
    else
      echo -e "\033[32mPlugin ${plugin##*/} already installed.\033[0m"
    fi
  done

  # Setup dotfiles

  notify "Terminal setup complete"
}

# Function to set up SSH configuration
set_ssh() {
  echo -e "\033[34mSetting up SSH configuration...\033[0m"
  mkdir -p ~/.ssh || {
    echo -e "\033[31mError: Failed to create ~/.ssh directory.\033[0m"
    log_action "Failed to create ~/.ssh directory"
    return 1
  }
  chmod 700 ~/.ssh

  local ssh_keys=(
    "qp_ed25519:sifat@macbook"
    "id_ed25519:mahi@mackbook"
  )

  for key in "${ssh_keys[@]}"; do
    IFS=':' read -r filename comment <<<"$key"
    if [[ ! -f ~/.ssh/$filename ]]; then
      ssh-keygen -t ed25519 -C "$comment" -f ~/.ssh/"$filename" -N "" || {
        echo -e "\033[31mWarning: Failed to generate SSH key $filename.\033[0m"
        log_action "Failed to generate SSH key $filename"
      }
    else
      echo -e "\033[32mSSH key $filename already exists.\033[0m"
    fi
  done

  cat >~/.ssh/config <<EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519

Host qp.github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/qp_ed25519
EOF

  chmod 600 ~/.ssh/config || {
    echo -e "\033[31mError: Failed to set permissions on ~/.ssh/config.\033[0m"
    log_action "Failed to set permissions on ~/.ssh/config"
    return 1
  }

  notify "SSH setup complete"
}

# Setup mac defaults
set_mac_defaults() {
  # dock settings
  defaults write com.apple.dock "autohide" -bool "true"
  defaults write com.apple.dock autohide-time-modifier -int 0
  defaults write com.apple.dock "show-recents" -bool "false"
  defaults write com.apple.dock "static-only" -bool "true"
  defaults write com.apple.dock "autohide-delay" -float "0"
  defaults write NSGlobalDomain _HIHideMenuBar -bool true
  defaults write com.apple.dock "expose-group-apps" -bool "true"
  killall Dock

  # finder settings
  defaults write com.apple.finder "FXPreferredViewStyle" -string "Nlsv"
  defaults write NSGlobalDomain "AppleShowAllExtensions" -bool "true"
  defaults write com.apple.finder "ShowPathbar" -bool "true"
  killall Finder

  # misc
  defaults write -g ApplePressAndHoldEnabled -bool false
  defaults write -g InitialKeyRepeat -int 20
  defaults write -g KeyRepeat -int 1
  defaults write NSGlobalDomain AppleKeyboardUIMode -int "2"
  defaults write com.apple.spaces "spans-displays" -bool "false" && killall SystemUIServer
}
set_apps
