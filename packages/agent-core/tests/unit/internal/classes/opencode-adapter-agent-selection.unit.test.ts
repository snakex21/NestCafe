import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { OpenCodeAdapter } from '../../../../src/internal/classes/OpenCodeAdapter.js';
import { NESTCAFE_AGENT_NAME } from '../../../../src/opencode/config-generator.js';
import type { FileAttachmentInfo } from '../../../../src/common/types/task.js';

/**
 * REGRESSION: the adapter used to pass `{ title }` to `session.create`
 * and nothing agent-related to `session.prompt`. The generated
 * `opencode.json` defines a custom `accomplish` agent containing the
 * entire Accomplish system prompt (skills, connectors, workspace
 * instructions, knowledge notes, etc.) and sets `default_agent:
 * 'accomplish'` at the config root. That default_agent IS honored by
 * the CLI path, which was invoked as `opencode --agent accomplish` —
 * but the SDK path (OpenCode SDK cutover port) has no implicit agent
 * selection. Without explicit `agent: NESTCAFE_AGENT_NAME` on each
 * `session.prompt`, OpenCode runs the session under its built-in
 * default agent and silently ignores the accomplish prompt.
 *
 * User-visible symptom: workspace `instruction`-type knowledge notes
 * are correctly written into the generated opencode.json (verified by
 * inspecting the file) but the model's replies show none of those
 * instructions being followed. The entire ~18KB Accomplish system
 * prompt — including the mandatory `<workspace-instructions>` block
 * prepended to the top — never reaches the model because the session
 * isn't configured to use the accomplish agent.
 *
 * Fix: pass `agent: NESTCAFE_AGENT_NAME` on BOTH session.prompt call
 * sites (initial prompt + continuation nudge). Per the current
 * `@opencode-ai/sdk` type defs, `SessionPromptData.body` accepts
 * `agent?: string`; `SessionCreateData.body` does not have an agent
 * field so create stays agent-less.
 *
 * These tests pin the fix at the narrow seam:
 *   - Initial startTask → session.prompt carries `agent: 'accomplish'`.
 *   - Continuation prompt → also carries `agent: 'accomplish'`.
 * If a future SDK upgrade or refactor silently drops the field, these
 * tests fail loudly before the PR lands.
 */
describe('OpenCodeAdapter agent selection on session.prompt', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  interface PromptCall {
    sessionID: string;
    agent?: string;
    system?: string;
    model?: { providerID: string; modelID: string };
    text?: string;
    parts: Array<{ type: string; text?: string; mime?: string; filename?: string; url?: string }>;
  }

  function buildFakeClient(): {
    client: unknown;
    promptCalls: PromptCall[];
  } {
    const promptCalls: PromptCall[] = [];

    const client = {
      session: {
        create: async (_args: { title: string }) => {
          return { id: 'session_abc' };
        },
        prompt: (args: {
          sessionID: string;
          agent?: string;
          system?: string;
          model?: { providerID: string; modelID: string };
          parts: Array<{
            type: string;
            text?: string;
            mime?: string;
            filename?: string;
            url?: string;
          }>;
        }) => {
          promptCalls.push({
            sessionID: args.sessionID,
            agent: args.agent,
            system: args.system,
            model: args.model,
            text: args.parts[0]?.text,
            parts: args.parts,
          });
          return Promise.resolve();
        },
      },
      event: {
        subscribe: async () => {
          const stream: AsyncIterable<unknown> = {
            [Symbol.asyncIterator]() {
              return {
                next: () => new Promise(() => {}), // never resolves
              };
            },
          };
          return { stream, close: () => {} };
        },
      },
    };

    return { client, promptCalls };
  }

  async function runStartTask(
    adapter: OpenCodeAdapter,
    config: { prompt: string; sessionId?: string; files?: FileAttachmentInfo[] },
    fake: ReturnType<typeof buildFakeClient>,
  ): Promise<void> {
    const adapterOpts = (
      adapter as unknown as {
        options: {
          getServerUrl: (taskId: string) => Promise<string>;
        };
      }
    ).options;
    adapterOpts.getServerUrl = async () => 'http://127.0.0.1:4096';

    let clientAssigned = false;
    Object.defineProperty(adapter, 'client', {
      configurable: true,
      get() {
        return clientAssigned ? fake.client : null;
      },
      set(_value: unknown) {
        clientAssigned = true;
      },
    });

    const startPromise = adapter.startTask({ ...config, taskId: 'tsk_agent_test' });
    await Promise.race([
      startPromise.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 200)),
    ]);
  }

  it('initial session.prompt carries agent: NESTCAFE_AGENT_NAME', async () => {
    const adapter = new OpenCodeAdapter(
      { platform: 'darwin', isPackaged: false, tempPath: '/tmp' },
      'tsk_agent_fresh',
    );
    const fake = buildFakeClient();
    await runStartTask(adapter, { prompt: 'tell me about yourself' }, fake);

    expect(fake.promptCalls.length).toBe(1);
    const call = fake.promptCalls[0];
    expect(call.agent).toBe(NESTCAFE_AGENT_NAME);
    expect(call.agent).toBe('accomplish'); // double-check the constant value
    expect(call.text).toBe('tell me about yourself');
  });

  it('sends image attachments as native file parts instead of text-only path markers', async () => {
    const adapter = new OpenCodeAdapter(
      { platform: 'darwin', isPackaged: false, tempPath: '/tmp' },
      'tsk_agent_image',
    );
    const fake = buildFakeClient();
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'accomplish-image-part-'));
    const imagePath = path.join(tmpDir, 'sample.png');
    await fs.writeFile(imagePath, Buffer.from('iVBORw0KGgo=', 'base64'));

    await runStartTask(
      adapter,
      {
        prompt: 'what is in this image?',
        files: [
          {
            id: 'att_1',
            name: 'sample.png',
            path: imagePath,
            type: 'image',
            size: 8,
          },
        ],
      },
      fake,
    );

    expect(fake.promptCalls.length).toBe(1);
    expect(fake.promptCalls[0].parts).toHaveLength(2);
    expect(fake.promptCalls[0].parts[0]).toMatchObject({
      type: 'text',
      text: 'what is in this image?',
    });
    expect(fake.promptCalls[0].parts[1]).toMatchObject({
      type: 'file',
      mime: 'image/png',
      filename: 'sample.png',
    });
    expect(fake.promptCalls[0].parts[1].url).toMatch(/^data:image\/png;base64,/);
  });

  it('resume (config.sessionId) session.prompt also carries agent: NESTCAFE_AGENT_NAME', async () => {
    const adapter = new OpenCodeAdapter(
      { platform: 'darwin', isPackaged: false, tempPath: '/tmp' },
      'tsk_agent_resume',
    );
    const fake = buildFakeClient();
    await runStartTask(
      adapter,
      { prompt: 'follow-up question', sessionId: 'existing_session' },
      fake,
    );

    expect(fake.promptCalls.length).toBe(1);
    expect(fake.promptCalls[0].agent).toBe(NESTCAFE_AGENT_NAME);
    expect(fake.promptCalls[0].sessionID).toBe('existing_session');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Runtime per-turn `system` injection for workspace instructions.
  //
  // The agent-level `agent.nestcafe.prompt` is not enough: the OpenAI/
  // Codex provider path inside OpenCode injects its own `options.instructions`
  // channel that crowds out the agent-level prompt, so mandatory user rules
  // (e.g. "always add Haiku suffix") never reach the model. Fix: `onBeforeStart`
  // returns `{ env, workspaceInstructions }`, the adapter stores the
  // instructions, and every `session.prompt` call includes them as the
  // SDK's first-class `system` field. These tests pin that pipeline.
  // ──────────────────────────────────────────────────────────────────────
  it('session.prompt carries system= with workspace instructions when onBeforeStart returns them', async () => {
    const adapter = new OpenCodeAdapter(
      {
        platform: 'darwin',
        isPackaged: false,
        tempPath: '/tmp',
        onBeforeStart: async () => ({
          env: {},
          workspaceInstructions: '- Always add "Haiku" suffix string for any reply',
        }),
      },
      'tsk_ws_instr',
    );
    const fake = buildFakeClient();
    await runStartTask(adapter, { prompt: 'tell me about yourself' }, fake);

    expect(fake.promptCalls.length).toBe(1);
    const call = fake.promptCalls[0];
    expect(call.system).toBeDefined();
    // The runtime block wraps the instructions under a mandatory header
    // that's deliberately terse but explicit about overriding the
    // conversational-bypass default-concise behavior.
    expect(call.system).toContain('MANDATORY WORKSPACE INSTRUCTIONS');
    // The exact user-supplied instruction text is preserved verbatim.
    expect(call.system).toContain('Always add "Haiku" suffix string for any reply');
    // It's wrapped in the <workspace-instructions> tag so the model can
    // pattern-match it reliably.
    expect(call.system).toContain('<workspace-instructions>');
    expect(call.system).toContain('</workspace-instructions>');
  });

  it('session.prompt omits system= when no workspace instructions are set', async () => {
    const adapter = new OpenCodeAdapter(
      {
        platform: 'darwin',
        isPackaged: false,
        tempPath: '/tmp',
        // onBeforeStart returns a legacy plain-env shape, no workspaceInstructions.
        onBeforeStart: async () => ({ NESTCAFE_SOME_VAR: '1' }) as NodeJS.ProcessEnv,
      },
      'tsk_no_instr',
    );
    const fake = buildFakeClient();
    await runStartTask(adapter, { prompt: 'hi' }, fake);

    expect(fake.promptCalls.length).toBe(1);
    // Legacy callers that return a bare env object shouldn't accidentally
    // trigger a `system` injection. The adapter only populates `system`
    // when `onBeforeStart` returns the rich `{ env, workspaceInstructions }`
    // shape with a non-empty `workspaceInstructions` field.
    expect(fake.promptCalls[0].system).toBeUndefined();
  });

  it('resume path also carries system= (workspace rules apply on every turn, not just session creation)', async () => {
    const adapter = new OpenCodeAdapter(
      {
        platform: 'darwin',
        isPackaged: false,
        tempPath: '/tmp',
        onBeforeStart: async () => ({
          env: {},
          workspaceInstructions: '- Reply in haiku form',
        }),
      },
      'tsk_resume_system',
    );
    const fake = buildFakeClient();
    await runStartTask(
      adapter,
      { prompt: 'follow-up', sessionId: 'session_was_created_before_note_was_added' },
      fake,
    );

    // The critical property: a session that was created BEFORE the user
    // added the workspace note must STILL get the instructions injected
    // on subsequent turns, because the runtime `system` field is per-call,
    // not sticky to session creation.
    expect(fake.promptCalls.length).toBe(1);
    expect(fake.promptCalls[0].sessionID).toBe('session_was_created_before_note_was_added');
    expect(fake.promptCalls[0].system).toContain('Reply in haiku form');
  });

  it('session.prompt carries the selected model returned by onBeforeStart', async () => {
    const adapter = new OpenCodeAdapter(
      {
        platform: 'darwin',
        isPackaged: false,
        tempPath: '/tmp',
        onBeforeStart: async () => ({
          env: {},
          selectedModel: { providerID: 'lmstudio', modelID: 'qwen3.6-35b-a3b' },
        }),
      },
      'tsk_selected_model',
    );
    const fake = buildFakeClient();
    await runStartTask(adapter, { prompt: 'hi' }, fake);

    expect(fake.promptCalls.length).toBe(1);
    expect(fake.promptCalls[0].model).toEqual({
      providerID: 'lmstudio',
      modelID: 'qwen3.6-35b-a3b',
    });
  });
});
