// CLI commands implementation

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { ProxyServer } from '../proxy/server.js';
import { JSONLStorage } from '../storage/jsonl.js';
import {
  extractSystemPrompt,
  analyzeSystemPrompt,
  getConversationStats,
  formatTokenCount,
} from '../parser/messages.js';
import {
  pairToolCallsWithResults,
  getToolCallFrequency,
} from '../parser/tools.js';

const DEFAULT_PORT = 3456;
const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');

export function createCLI(): Command {
  const program = new Command();

  program
    .name('claude-reverse')
    .description('Intercept, log, and visualize Claude Code LLM interactions')
    .version('1.0.0');

  // Start command
  program
    .command('start')
    .description('Start the proxy server to intercept Claude Code requests')
    .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
    .option('-d, --data-dir <dir>', 'Directory to store captured data', DEFAULT_DATA_DIR)
    .option('-q, --quiet', 'Suppress verbose output')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const dataDir = path.resolve(options.dataDir);

      console.log(chalk.bold.cyan('\n  Claude Code Reverse Engineering Tool\n'));
      console.log(chalk.gray('  ─'.repeat(30)));

      const server = new ProxyServer({
        port,
        dataDir,
        verbose: !options.quiet,
      });

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        await server.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      await server.start();

      console.log(chalk.gray('  ─'.repeat(30)));
      console.log(chalk.green('\n  Proxy server is running!\n'));
      console.log(chalk.white('  To start capturing, run Claude Code with:'));
      console.log(chalk.cyan(`    ANTHROPIC_BASE_URL=http://localhost:${port} claude\n`));
      console.log(chalk.white('  Web dashboard (when running):'));
      console.log(chalk.cyan(`    http://localhost:3000\n`));
      console.log(chalk.gray('  Press Ctrl+C to stop\n'));
    });

  // Analyze command
  program
    .command('analyze')
    .description('Analyze captured data')
    .option('-d, --data-dir <dir>', 'Directory with captured data', DEFAULT_DATA_DIR)
    .option('--system-prompt', 'Show system prompt analysis')
    .option('--tools', 'Show tool usage statistics')
    .option('--tokens', 'Show token usage statistics')
    .option('--all', 'Show all analyses')
    .action((options) => {
      const dataDir = path.resolve(options.dataDir);
      const storage = new JSONLStorage(dataDir);

      const requests = storage.readRequests();
      const responses = storage.readResponses();

      if (requests.length === 0) {
        console.log(chalk.yellow('\nNo captured data found.\n'));
        console.log(chalk.gray('Run the proxy server and use Claude Code to capture data first:\n'));
        console.log(chalk.cyan('  claude-reverse start'));
        console.log(chalk.cyan('  ANTHROPIC_BASE_URL=http://localhost:3456 claude\n'));
        return;
      }

      console.log(chalk.bold.cyan('\n  Claude Code Analysis\n'));
      console.log(chalk.gray('  ─'.repeat(30)));

      const showAll = options.all || (!options.systemPrompt && !options.tools && !options.tokens);

      // Basic stats
      console.log(chalk.white('\n  Summary:'));
      console.log(chalk.gray(`    Captured requests: ${requests.length}`));
      console.log(chalk.gray(`    Captured responses: ${responses.length}\n`));

      // System prompt analysis
      if (showAll || options.systemPrompt) {
        const firstRequestWithSystem = requests.find((r) => r.system && r.system.length > 0);
        if (firstRequestWithSystem) {
          const analysis = analyzeSystemPrompt(firstRequestWithSystem);
          console.log(chalk.bold.white('  System Prompt Analysis:\n'));
          console.log(chalk.gray(`    Word count: ${analysis.wordCount.toLocaleString()}`));
          console.log(chalk.gray(`    Character count: ${analysis.characterCount.toLocaleString()}`));
          console.log(chalk.gray(`    Cache control: ${analysis.hasCacheControl ? 'Yes' : 'No'}`));

          if (analysis.sections.length > 0) {
            console.log(chalk.gray(`    Sections: ${analysis.sections.length}\n`));
            console.log(chalk.white('    Section titles:'));
            for (const section of analysis.sections.slice(0, 15)) {
              console.log(chalk.gray(`      - ${section.title}`));
            }
            if (analysis.sections.length > 15) {
              console.log(chalk.gray(`      ... and ${analysis.sections.length - 15} more`));
            }
          }
          console.log();
        } else {
          console.log(chalk.yellow('  No system prompt found in captured data.\n'));
        }
      }

      // Token analysis
      if (showAll || options.tokens) {
        const stats = getConversationStats(requests, responses);
        console.log(chalk.bold.white('  Token Usage:\n'));
        console.log(chalk.gray(`    Total input tokens:     ${formatTokenCount(stats.totalInputTokens)}`));
        console.log(chalk.gray(`    Total output tokens:    ${formatTokenCount(stats.totalOutputTokens)}`));
        console.log(chalk.gray(`    Cache read tokens:      ${formatTokenCount(stats.cacheReadTokens)}`));
        console.log(chalk.gray(`    Cache creation tokens:  ${formatTokenCount(stats.cacheCreationTokens)}`));
        console.log(chalk.gray(`    Average response time:  ${Math.round(stats.averageResponseTime)}ms`));
        console.log();
      }

      // Tool analysis
      if (showAll || options.tools) {
        const toolCalls = pairToolCallsWithResults(requests, responses);
        const frequency = getToolCallFrequency(toolCalls);

        console.log(chalk.bold.white('  Tool Usage:\n'));
        console.log(chalk.gray(`    Total tool calls: ${toolCalls.length}\n`));

        if (frequency.length > 0) {
          console.log(chalk.white('    Top tools:'));
          for (const { name, count } of frequency.slice(0, 15)) {
            const bar = '█'.repeat(Math.min(count, 30));
            console.log(chalk.gray(`      ${name.padEnd(30)} ${bar} ${count}`));
          }
          if (frequency.length > 15) {
            console.log(chalk.gray(`      ... and ${frequency.length - 15} more tools`));
          }
        }
        console.log();
      }

      console.log(chalk.gray('  ─'.repeat(30)));
      console.log();
    });

  // Export command
  program
    .command('export')
    .description('Export captured data to various formats')
    .option('-d, --data-dir <dir>', 'Directory with captured data', DEFAULT_DATA_DIR)
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (json, jsonl, system-prompt)', 'json')
    .action((options) => {
      const dataDir = path.resolve(options.dataDir);
      const storage = new JSONLStorage(dataDir);

      const requests = storage.readRequests();
      const responses = storage.readResponses();

      if (requests.length === 0) {
        console.log(chalk.yellow('\nNo captured data found.\n'));
        return;
      }

      let output: string;
      let defaultFilename: string;

      switch (options.format) {
        case 'system-prompt': {
          const firstRequestWithSystem = requests.find((r) => r.system && r.system.length > 0);
          if (!firstRequestWithSystem) {
            console.log(chalk.yellow('\nNo system prompt found in captured data.\n'));
            return;
          }
          output = extractSystemPrompt(firstRequestWithSystem);
          defaultFilename = 'system-prompt.txt';
          break;
        }

        case 'jsonl': {
          const pairs = storage.getRequestResponsePairs();
          output = pairs.map((p) => JSON.stringify(p)).join('\n');
          defaultFilename = 'captured-data.jsonl';
          break;
        }

        case 'json':
        default: {
          const pairs = storage.getRequestResponsePairs();
          output = JSON.stringify(pairs, null, 2);
          defaultFilename = 'captured-data.json';
          break;
        }
      }

      const outputPath = options.output || path.join(dataDir, defaultFilename);
      fs.writeFileSync(outputPath, output);

      console.log(chalk.green(`\nExported to: ${outputPath}\n`));
    });

  // System prompt command (shortcut)
  program
    .command('system-prompt')
    .description('Extract and display the system prompt')
    .option('-d, --data-dir <dir>', 'Directory with captured data', DEFAULT_DATA_DIR)
    .option('-o, --output <file>', 'Save to file instead of displaying')
    .action((options) => {
      const dataDir = path.resolve(options.dataDir);
      const storage = new JSONLStorage(dataDir);

      const requests = storage.readRequests();
      const firstRequestWithSystem = requests.find((r) => r.system && r.system.length > 0);

      if (!firstRequestWithSystem) {
        console.log(chalk.yellow('\nNo system prompt found in captured data.\n'));
        return;
      }

      const systemPrompt = extractSystemPrompt(firstRequestWithSystem);

      if (options.output) {
        fs.writeFileSync(options.output, systemPrompt);
        console.log(chalk.green(`\nSystem prompt saved to: ${options.output}\n`));
      } else {
        console.log(chalk.bold.cyan('\n  Claude Code System Prompt\n'));
        console.log(chalk.gray('  ─'.repeat(30)));
        console.log();
        console.log(systemPrompt);
        console.log();
        console.log(chalk.gray('  ─'.repeat(30)));
        console.log();
      }
    });

  // Clear command
  program
    .command('clear')
    .description('Clear captured data')
    .option('-d, --data-dir <dir>', 'Directory with captured data', DEFAULT_DATA_DIR)
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options) => {
      const dataDir = path.resolve(options.dataDir);

      if (!options.yes) {
        console.log(chalk.yellow('\nThis will delete all captured data in:'));
        console.log(chalk.gray(`  ${dataDir}\n`));
        console.log(chalk.white('Use --yes to confirm.\n'));
        return;
      }

      const storage = new JSONLStorage(dataDir);
      storage.clear();

      console.log(chalk.green('\nCaptured data cleared.\n'));
    });

  return program;
}
