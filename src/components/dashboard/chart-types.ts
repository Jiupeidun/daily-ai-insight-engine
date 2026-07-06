export type TopicDatum = {
  topic: string;
  label: string;
  count: number;
  avgImpact: number;
};

export type SourceDatum = {
  type: string;
  count: number;
};

export type TimelineDatum = {
  date: string;
  count: number;
  avgImpact: number;
  maxImpact: number;
};

export type MomentumDatum = {
  signal: string;
  type: string;
  recentCount: number;
  baselineCount: number;
  momentumScore: number;
  direction: string;
  rationale: string;
};

export type SignalDatum = {
  signal: string;
  value: number;
};

export type ValueChainDatum = {
  valueChain: string;
  count: number;
};

export type DashboardCharts = {
  topicDistribution: TopicDatum[];
  sourceMix: SourceDatum[];
  impactTimeline: TimelineDatum[];
  momentumSignals: MomentumDatum[];
  signalRadar: SignalDatum[];
  valueChainMap: ValueChainDatum[];
};
