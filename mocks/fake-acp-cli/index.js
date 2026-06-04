#!/usr/bin/env node
/**
 * Fake ACP CLI for testing.
 *
 * Minimal ACP JSON-RPC 2.0 server communicating via stdin/stdout.
 * Supports: initialize, session/new, session/prompt (streaming chunks).
 */

const JSONRPC_VERSION = '2.0';

let sessionCounter = 0;
let nextServerRequestId = 1000;
const pendingServerRequests = new Map();

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, result });
  process.stdout.write(msg + '\n');
}

function sendNotification(method, params) {
  const msg = JSON.stringify({ jsonrpc: JSONRPC_VERSION, method, params });
  process.stdout.write(msg + '\n');
}

function sendRequest(method, params, onResponse) {
  const id = nextServerRequestId++;
  const timeout = setTimeout(() => {
    if (!pendingServerRequests.delete(id)) return;
    onResponse({
      jsonrpc: JSONRPC_VERSION,
      id,
      error: { code: -32000, message: `Client request timed out: ${method}` },
    });
  }, 5000);
  pendingServerRequests.set(id, { onResponse, timeout });
  const msg = JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, method, params });
  process.stdout.write(msg + '\n');
}

function handleResponse(message) {
  const pending = pendingServerRequests.get(message.id);
  if (!pending) return false;
  pendingServerRequests.delete(message.id);
  clearTimeout(pending.timeout);
  pending.onResponse(message);
  return true;
}

function handleRequest(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize': {
      sendResponse(id, {
        protocolVersion: 1,
        serverCapabilities: {
          streaming: true,
          sessionManagement: true,
        },
        serverInfo: {
          name: 'fake-acp-cli',
          version: '1.0.0',
        },
      });
      break;
    }

    case 'session/new': {
      sessionCounter++;
      const sessionId = `fake-session-${sessionCounter}`;
      sendResponse(id, {
        sessionId,
        modes: [],
        configOptions: [],
        models: {
          currentModelId: 'fake-model-1',
          availableModels: [{ id: 'fake-model-1', name: 'Fake Model' }],
        },
      });
      break;
    }

    case 'session/prompt': {
      const sessionId = params?.sessionId || 'unknown';
      const promptText = Array.isArray(params?.prompt) && params.prompt[0]?.text ? params.prompt[0].text : 'unknown';

      if (process.env.FAKE_ACP_TRIGGER_GUI_EXECUTE === '1') {
        const toolUseId = 'fake-gui-tool-1';
        sendNotification('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: toolUseId,
            title: 'GUI_execute',
            kind: 'other',
            status: 'in_progress',
          },
        });
        sendRequest('_viben/client_tool_call', {
          sessionId,
          toolName: 'GUI_execute',
          toolUseId,
          input: {
            action: 'get_action_detail',
            payload: { action: 'app.open_settings' },
          },
        }, (response) => {
          sendNotification('session/update', {
            sessionId,
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: toolUseId,
              status: response.error ? 'failed' : 'completed',
            },
          });
          sendNotification('session/update', {
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: `GUI_execute result: ${JSON.stringify(response.result ?? response.error)}`,
              },
            },
          });
          sendResponse(id, {
            stopReason: response.error ? 'error' : 'end_turn',
            usage: {
              inputTokens: 12,
              outputTokens: 24,
              totalTokens: 36,
            },
          });
        });
        break;
      }

      // Send streaming chunks via session/update notifications
      const responseText = `Fake response to: ${promptText}`;
      const chunks = [responseText.slice(0, 10), responseText.slice(10)];

      for (const chunk of chunks) {
        sendNotification('session/update', {
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: chunk },
          },
        });
      }

      // Final response with end_turn
      sendResponse(id, {
        stopReason: 'end_turn',
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      });
      break;
    }

    case 'session/cancel': {
      // Notification, no response needed
      break;
    }

    case 'session/set_mode':
    case 'session/set_model':
    case 'session/set_config_option': {
      sendResponse(id, {});
      break;
    }

    default: {
      if (id !== undefined) {
        const msg = JSON.stringify({
          jsonrpc: JSONRPC_VERSION,
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
        process.stdout.write(msg + '\n');
      }
      break;
    }
  }
}

// Read JSON-RPC messages from stdin, one per line

const stdin = require('readline').createInterface({ input: process.stdin, terminal: false });

stdin.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const message = JSON.parse(trimmed);
    if (message && typeof message === 'object' && 'id' in message && !('method' in message)) {
      if (handleResponse(message)) return;
    }
    handleRequest(message);
  } catch {
    // Ignore parse errors
  }
});

// Keep process alive
process.stdin.resume();
