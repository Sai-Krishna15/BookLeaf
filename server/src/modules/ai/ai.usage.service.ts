import { prisma } from '../../config/prisma';

export interface AiUsageGroup {
  kind: string;
  provider: string;
  calls: number;
  failures: number;
  successRate: number; // between 0.0 and 1.0
  inputTokens: number;
  outputTokens: number;
  averageLatencyMs: number;
}

export interface AiUsageReport {
  windowDays: number;
  from: string;
  to: string;
  totals: {
    calls: number;
    failures: number;
    successRate: number;
    inputTokens: number;
    outputTokens: number;
    averageLatencyMs: number;
  };
  byKindAndProvider: AiUsageGroup[];
}

export async function getAiUsageReport(days = 7): Promise<AiUsageReport> {
  const windowDays = Math.max(1, Math.min(days, 365));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const logs = await prisma.aiCallLog.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: {
      kind: true,
      provider: true,
      latencyMs: true,
      inputTokens: true,
      outputTokens: true,
      success: true,
    },
  });

  // Group by `${kind}:${provider}`
  const groupMap = new Map<
    string,
    {
      kind: string;
      provider: string;
      calls: number;
      failures: number;
      inputTokens: number;
      outputTokens: number;
      totalLatencyMs: number;
    }
  >();

  let totalCalls = 0;
  let totalFailures = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatency = 0;

  for (const log of logs) {
    const key = `${log.kind}:${log.provider}`;
    let g = groupMap.get(key);
    if (!g) {
      g = {
        kind: log.kind,
        provider: log.provider,
        calls: 0,
        failures: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalLatencyMs: 0,
      };
      groupMap.set(key, g);
    }

    g.calls++;
    if (!log.success) g.failures++;
    g.inputTokens += log.inputTokens ?? 0;
    g.outputTokens += log.outputTokens ?? 0;
    g.totalLatencyMs += log.latencyMs;

    totalCalls++;
    if (!log.success) totalFailures++;
    totalInputTokens += log.inputTokens ?? 0;
    totalOutputTokens += log.outputTokens ?? 0;
    totalLatency += log.latencyMs;
  }

  const byKindAndProvider: AiUsageGroup[] = Array.from(groupMap.values()).map((g) => ({
    kind: g.kind,
    provider: g.provider,
    calls: g.calls,
    failures: g.failures,
    successRate: g.calls > 0 ? Math.round(((g.calls - g.failures) / g.calls) * 100) / 100 : 1,
    inputTokens: g.inputTokens,
    outputTokens: g.outputTokens,
    averageLatencyMs: g.calls > 0 ? Math.round(g.totalLatencyMs / g.calls) : 0,
  }));

  return {
    windowDays,
    from: since.toISOString(),
    to: now.toISOString(),
    totals: {
      calls: totalCalls,
      failures: totalFailures,
      successRate: totalCalls > 0 ? Math.round(((totalCalls - totalFailures) / totalCalls) * 100) / 100 : 1,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      averageLatencyMs: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
    },
    byKindAndProvider,
  };
}
