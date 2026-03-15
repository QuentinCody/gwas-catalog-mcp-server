#!/usr/bin/env node

/**
 * Regression tests for gwas-catalog-mcp-server structuredContent responses.
 * Updated for GWAS Catalog REST API v2.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    failedTests++;
  }
}

function assertFileExists(relPath, testName) {
  totalTests++;
  const fullPath = path.join(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    failedTests++;
    return '';
  }
}

// Verify core server files exist
const index = assertFileExists('src/index.ts', 'index.ts exists');
const doFile = assertFileExists('src/do.ts', 'do.ts exists');
const catalog = assertFileExists('src/spec/catalog.ts', 'catalog.ts exists');
const adapter = assertFileExists('src/lib/api-adapter.ts', 'api-adapter.ts exists');
const http = assertFileExists('src/lib/http.ts', 'http.ts exists');
const codeMode = assertFileExists('src/tools/code-mode.ts', 'code-mode.ts exists');
const queryData = assertFileExists('src/tools/query-data.ts', 'query-data.ts exists');
const getSchema = assertFileExists('src/tools/get-schema.ts', 'get-schema.ts exists');
const aiStub = assertFileExists('src/ai-stub.ts', 'ai-stub.ts exists');
const wrangler = assertFileExists('wrangler.jsonc', 'wrangler.jsonc exists');
const packageJson = assertFileExists('package.json', 'package.json exists');

// Verify key patterns in source
if (index) {
  assertContains('src/index.ts', index, 'GwasDataDO', 'index exports GwasDataDO');
  assertContains('src/index.ts', index, 'MyMCP', 'index exports MyMCP');
  assertContains('src/index.ts', index, '/health', 'index has health endpoint');
  assertContains('src/index.ts', index, '/mcp', 'index has mcp endpoint');
}

if (doFile) {
  assertContains('src/do.ts', doFile, 'RestStagingDO', 'DO extends RestStagingDO');
  assertContains('src/do.ts', doFile, 'GwasDataDO', 'DO class named GwasDataDO');
  assertContains('src/do.ts', doFile, 'studies', 'DO has studies schema hint');
  assertContains('src/do.ts', doFile, 'associations', 'DO has associations schema hint');
  assertContains('src/do.ts', doFile, 'snps', 'DO has snps schema hint');
  // v2-specific hints
  assertContains('src/do.ts', doFile, 'publications', 'DO has publications schema hint');
  assertContains('src/do.ts', doFile, 'genomic_contexts', 'DO has genomic_contexts schema hint');
  assertContains('src/do.ts', doFile, 'efo_traits', 'DO has efo_traits schema hint');
}

if (catalog) {
  assertContains('src/spec/catalog.ts', catalog, 'ApiCatalog', 'catalog uses ApiCatalog type');
  assertContains('src/spec/catalog.ts', catalog, 'gwasCatalog', 'catalog exports gwasCatalog');
  // v2 endpoint paths
  assertContains('src/spec/catalog.ts', catalog, '/v2/studies', 'catalog has v2 studies endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/v2/associations', 'catalog has v2 associations endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/v2/single-nucleotide-polymorphisms', 'catalog has v2 SNPs endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/v2/efo-traits', 'catalog has v2 EFO traits endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/v2/publications', 'catalog has v2 publications endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/v2/genes', 'catalog has v2 genes endpoint');
  assertContains('src/spec/catalog.ts', catalog, '_embedded', 'catalog notes mention _embedded');
  assertContains('src/spec/catalog.ts', catalog, 'HAL', 'catalog notes mention HAL format');
  assertContains('src/spec/catalog.ts', catalog, 'v2', 'catalog is v2');
  // v2 snake_case parameter names
  assertContains('src/spec/catalog.ts', catalog, 'pubmed_id', 'catalog uses snake_case pubmed_id');
  assertContains('src/spec/catalog.ts', catalog, 'accession_id', 'catalog uses snake_case accession_id');
  assertContains('src/spec/catalog.ts', catalog, 'rs_id', 'catalog uses snake_case rs_id');
  assertContains('src/spec/catalog.ts', catalog, 'efo_id', 'catalog uses snake_case efo_id');
}

if (http) {
  assertContains('src/lib/http.ts', http, 'restFetch', 'http uses restFetch from shared');
  assertContains('src/lib/http.ts', http, 'ebi.ac.uk/gwas', 'http has GWAS base URL');
  assertContains('src/lib/http.ts', http, 'gwasFetch', 'http exports gwasFetch');
}

if (adapter) {
  assertContains('src/lib/api-adapter.ts', adapter, 'ApiFetchFn', 'adapter uses ApiFetchFn type');
  assertContains('src/lib/api-adapter.ts', adapter, 'createGwasApiFetch', 'adapter exports createGwasApiFetch');
}

if (codeMode) {
  assertContains('src/tools/code-mode.ts', codeMode, 'gwas', 'code-mode uses gwas prefix');
  assertContains('src/tools/code-mode.ts', codeMode, 'createSearchTool', 'code-mode uses createSearchTool');
  assertContains('src/tools/code-mode.ts', codeMode, 'createExecuteTool', 'code-mode uses createExecuteTool');
}

if (queryData) {
  assertContains('src/tools/query-data.ts', queryData, 'gwas_query_data', 'registers gwas_query_data');
  assertContains('src/tools/query-data.ts', queryData, 'GWAS_DATA_DO', 'query-data uses GWAS_DATA_DO binding');
}

if (getSchema) {
  assertContains('src/tools/get-schema.ts', getSchema, 'gwas_get_schema', 'registers gwas_get_schema');
  assertContains('src/tools/get-schema.ts', getSchema, 'GWAS_DATA_DO', 'get-schema uses GWAS_DATA_DO binding');
}

if (wrangler) {
  assertContains('wrangler.jsonc', wrangler, 'GwasDataDO', 'wrangler has GwasDataDO class');
  assertContains('wrangler.jsonc', wrangler, 'GWAS_DATA_DO', 'wrangler has GWAS_DATA_DO binding');
  assertContains('wrangler.jsonc', wrangler, '8833', 'wrangler uses port 8833');
  assertContains('wrangler.jsonc', wrangler, 'CODE_MODE_LOADER', 'wrangler has CODE_MODE_LOADER');
}

if (packageJson) {
  assertContains('package.json', packageJson, 'gwas-catalog-mcp-server', 'package.json has correct name');
  assertContains('package.json', packageJson, '@bio-mcp/shared', 'package.json has shared dependency');
}

if (aiStub) {
  assertContains('src/ai-stub.ts', aiStub, 'jsonSchema', 'ai-stub exports jsonSchema');
}

// Summary
console.log(`\n${passedTests}/${totalTests} tests passed`);
if (failedTests > 0) {
  console.log(`${RED}${failedTests} tests FAILED${RESET}`);
  process.exit(1);
}
