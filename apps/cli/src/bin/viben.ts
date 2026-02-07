#!/usr/bin/env node
/**
 * Viben CLI Entry Point
 *
 * Bootstrap CLI for Viben - configure applications, manage services, and query status.
 */

import { cli } from "../cli.js";

cli.parse(process.argv);
