export type Provider = {
  name: string;
  icon: string;
  color: string;
};

export type WidgetData = {
  provider: Provider;
  modelName: string;
  thinking: string;
  tokens: string;
  percent: string;
  project: string;
  git: string;
  dirty: string;
  tool: string;
};

export type RenderOutput = {
  top: string[];
  bottom: string[];
};
