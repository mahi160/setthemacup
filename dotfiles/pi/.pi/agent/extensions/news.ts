import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("news", {
    description: "Dhaka news digest",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("news", "Fetching digest...");
      
      try {
        const fetchNews = async (url: string) => {
          const response = await fetch(url);
          const data = await response.text();
          // Extract items, then title and description for each
          const items = [...data.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);
          
          return items.map((item) => {
            const title = (item[1].match(/<title>(.*?)<\/title>/)?.[1] || "No title").replace(/<!\[CDATA\[(.*?)\]\]>/, "$1");
            const description = (item[1].match(/<description>(.*?)<\/description>/)?.[1] || "").replace(/<!\[CDATA\[(.*?)\]\]>/, "$1").replace(/<[^>]+>/g, "").trim();
            return { title, description: description.substring(0, 150) + (description.length > 150 ? "..." : "") };
          });
        };

        const [national, international, cricket, football, tennis] = await Promise.all([
          fetchNews("https://www.thedailystar.net/rss.xml"),
          fetchNews("https://feeds.bbci.co.uk/news/world/rss.xml"),
          fetchNews("https://www.espncricinfo.com/rss/content/rss.xml"),
          fetchNews("https://www.skysports.com/rss/11661"),
          fetchNews("https://www.atptour.com/-/rss/feeds/news/en"),
        ]);

        let digest = "## 📰 Latest News Digest\n\n";
        
        const formatSection = (title: string, items: { title: string, description: string }[]) => {
          let section = `### ${title}\n`;
          if (items.length === 0) return section + "- No updates at this moment.\n\n";
          return section + items.map(i => `**${i.title}**\n${i.description}\n`).join("\n") + "\n";
        };

        digest += formatSection("🇧🇩 National", national);
        digest += formatSection("🌍 International", international);
        digest += formatSection("🏏 Cricket", cricket);
        digest += formatSection("⚽ Football", football);
        digest += formatSection("🎾 Tennis", tennis);

        pi.sendMessage({
          customType: "news-digest",
          content: digest,
          display: true,
        });
      } catch (e) {
        console.error(e);
        ctx.ui.notify("Failed to fetch news", "error");
      } finally {
        ctx.ui.setStatus("news", "");
      }
    },
  });
}
