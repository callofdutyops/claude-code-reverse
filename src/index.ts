#!/usr/bin/env node

import { createCLI } from './cli/commands.js';

const program = createCLI();
program.parse();
