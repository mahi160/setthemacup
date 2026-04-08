export interface Provider {
  name: string;
  icon: string;
  color: string;
}

export interface WidgetData {
  provider: Provider;
  model: string;
  thinking: string;
  tokens: string;
  percent: string;
  project: string;
  branch: string;
  dirty: string;
  tools: string;
}
