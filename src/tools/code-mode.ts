/**
 * GWAS Catalog Code Mode — registers search + execute tools for full API access.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { gwasCatalog } from "../spec/catalog";
import { createGwasApiFetch } from "../lib/api-adapter";
import { gwasResponse } from "../lib/tool-result";

interface CodeModeEnv {
    GWAS_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
}

/**
 * Register gwas_search and gwas_execute tools.
 */
export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createGwasApiFetch();
    const registrar = { tool: (...args: unknown[]) => {
        const [name, ...rest] = args;
        // SAFETY: shared factories provide SDK arguments; the wrapper preserves the handler contract.
        const register = server.tool.bind(server) as (...values: unknown[]) => void;
        const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof gwasResponse>;
        const respond = (input: unknown, extra: unknown) => gwasResponse(() => handler(input, extra), env, String(name), extra, input);
        register(name, ...rest, respond); register(`mcp_${String(name)}`, ...rest, respond);
    } };

    // Register the search tool (in-process, no isolate)
    const searchTool = createSearchTool({
        prefix: "gwas",
        catalog: gwasCatalog,
    });
    searchTool.register(registrar);

    // Register the execute tool (V8 isolate via DynamicWorkerExecutor)
    const executeTool = createExecuteTool({
        prefix: "gwas",
        // Verifiable provenance: gwas_execute results carry a _meta.citation.
        source: { id: "gwas", name: "GWAS Catalog", url: "https://www.ebi.ac.uk/gwas" },
        catalog: gwasCatalog,
        apiFetch,
        preserveApiErrors: true,
        maxInlineBytes: 30 * 1024,
        stagingThreshold: 30 * 1024,
        timeout: 60000,
        doNamespace: env.GWAS_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrar);
}
