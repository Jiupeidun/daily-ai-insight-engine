import { NextResponse, type NextRequest } from "next/server";

function absoluteUrl(request: NextRequest, path: string) {
  return new URL(path, request.url).toString();
}

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Daily AI Insight Engine Agent API",
      version: "0.1.0",
      description:
        "Machine-readable API contract for agent workflows over the AI daily insight report."
    },
    servers: [{ url: origin }],
    paths: {
      "/api/agent/manifest": {
        get: {
          operationId: "getAgentManifest",
          summary: "List agent-callable tools and operating guidance.",
          responses: {
            "200": {
              description: "Agent tool manifest",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentManifest" }
                }
              }
            }
          }
        }
      },
      "/api/agent/schema": {
        get: {
          operationId: "getStructuredSchemaContract",
          summary: "Fetch schema, refresh cadence, and agent usage rules.",
          responses: {
            "200": {
              description: "Structured schema contract",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true }
                }
              }
            }
          }
        }
      },
      "/api/report": {
        get: {
          operationId: "getLatestAiReport",
          summary: "Fetch the latest structured AI daily report.",
          responses: {
            "200": {
              description: "Latest report",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DailyReport" }
                }
              }
            }
          }
        }
      },
      "/api/analyze": {
        post: {
          operationId: "askAiReport",
          summary: "Ask an analyst question grounded in the latest report.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    question: {
                      type: "string",
                      maxLength: 500
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Grounded analyst answer",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AnalyzeResponse" }
                }
              }
            }
          }
        }
      },
      "/api/report/pdf": {
        post: {
          operationId: "downloadAiReportPdf",
          summary: "Generate a PDF report after synthesis validation.",
          responses: {
            "200": {
              description: "PDF report",
              content: {
                "application/pdf": {
                  schema: {
                    type: "string",
                    format: "binary"
                  }
                }
              }
            },
            "502": { description: "AI synthesis did not pass validation" },
            "503": { description: "AI provider configuration is missing" }
          }
        }
      },
      "/api/admin/generate-report": {
        post: {
          operationId: "refreshAiReport",
          summary: "Run the full structured extraction and report pipeline.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Generated report and failed-record audit trail" },
            "401": { description: "Missing or invalid admin token" }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer"
        }
      },
      schemas: {
        AgentManifest: {
          type: "object",
          required: ["name", "version", "tools", "agentGuidance"],
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            description: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            contract: { type: "object", additionalProperties: true },
            tools: {
              type: "array",
              items: { $ref: "#/components/schemas/AgentTool" }
            },
            agentGuidance: {
              type: "array",
              items: { type: "string" }
            }
          }
        },
        AgentTool: {
          type: "object",
          required: ["name", "method", "endpoint", "auth", "purpose", "output"],
          properties: {
            name: { type: "string" },
            method: { type: "string", enum: ["GET", "POST"] },
            endpoint: { type: "string", format: "uri" },
            auth: { type: "string" },
            inputSchema: { type: "object", additionalProperties: true },
            purpose: { type: "string" },
            output: { type: "string" }
          }
        },
        DailyReport: {
          type: "object",
          description:
            "Validated report object. The authoritative runtime schema is DailyReportSchema in src/lib/insight/schema.ts.",
          required: [
            "id",
            "title",
            "generatedAt",
            "sourceStats",
            "qualityGates",
            "topEvents",
            "trendRadar",
            "articles"
          ],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            executiveBrief: { type: "string" },
            sourceStats: { type: "object", additionalProperties: true },
            schemaRationale: {
              type: "array",
              items: { type: "string" }
            },
            qualityGates: {
              type: "array",
              items: { $ref: "#/components/schemas/QualityGate" }
            },
            topEvents: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            deepDives: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            trendRadar: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            riskOpportunity: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            charts: { type: "object", additionalProperties: true },
            articles: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            methodology: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            }
          }
        },
        QualityGate: {
          type: "object",
          required: ["name", "status", "value", "rationale"],
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["pass", "warn", "fail"] },
            value: { type: "string" },
            rationale: { type: "string" }
          }
        },
        AnalyzeResponse: {
          type: "object",
          required: ["provider", "answer"],
          properties: {
            provider: { type: "string" },
            model: { type: "string" },
            answer: { type: "string" }
          }
        }
      }
    },
    "x-agent-contract": {
      manifest: absoluteUrl(request, "/api/agent/manifest"),
      schema: absoluteUrl(request, "/api/agent/schema"),
      grounding:
        "Agents should treat /api/report as the source of truth and use /api/analyze only for grounded follow-up reasoning.",
      audit:
        "Downstream claims should preserve cited URLs, quality gates, confidence scores, and related article ids."
    }
  };

  return NextResponse.json(spec, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300"
    }
  });
}
