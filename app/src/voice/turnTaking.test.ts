import { describe, expect, it } from "vitest";

import { VoiceController } from "./turnTaking";
import { VoiceCancelledError, type VoiceEvent } from "./types";
import { FakeRecognizer, FakeSynth, FakeTimer } from "../../test/support/fakeVoice";

interface Harness {
  controller: VoiceController;
  synth: FakeSynth;
  recognizer: FakeRecognizer;
  timer: FakeTimer;
  events: VoiceEvent[];
}

function harness(options: { silenceMs?: number; maxListenMs?: number; autoConfirmMs?: number } = {}): Harness {
  const synth = new FakeSynth();
  const recognizer = new FakeRecognizer();
  const timer = new FakeTimer();
  const events: VoiceEvent[] = [];
  const controller = new VoiceController({
    synth,
    recognizer,
    timer,
    onEvent: (e) => events.push(e),
    silenceMs: options.silenceMs ?? 2500,
    maxListenMs: options.maxListenMs ?? 60_000,
    autoConfirmMs: options.autoConfirmMs ?? 0,
  });
  return { controller, synth, recognizer, timer, events };
}

const states = (events: VoiceEvent[]): string[] =>
  events.filter((e): e is Extract<VoiceEvent, { type: "state" }> => e.type === "state").map((e) => e.state);

/** Let queued microtasks run so awaited transitions settle. */
const tick = () => new Promise<void>((r) => setImmediate(r));

describe("VoiceController.askUser", () => {
  it("speaks the question, listens, and returns the confirmed answer", async () => {
    const h = harness();
    const answer = h.controller.askUser("What was your biggest win today?");

    await tick();
    expect(h.synth.spoken).toEqual(["What was your biggest win today?"]);
    expect(h.controller.getState()).toBe("speaking");

    h.synth.finish(); // question finished playing
    await tick();
    expect(h.controller.getState()).toBe("listening");
    expect(h.recognizer.started).toBe(1);

    h.recognizer.partial("Shipped the git");
    h.recognizer.final("Shipped the git adapter.");
    await tick();
    expect(h.controller.getState()).toBe("reviewing");

    h.controller.confirm();
    expect(await answer).toBe("Shipped the git adapter.");
    expect(states(h.events)).toEqual(["speaking", "listening", "reviewing", "done"]);
  });

  it("ends listening after a silence gap", async () => {
    const h = harness({ silenceMs: 2000 });
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();

    h.recognizer.partial("A quiet");
    h.recognizer.partial("A quiet evening");
    // No further speech; the silence timer should stop the recognizer.
    expect(h.recognizer.stopped).toBe(0);
    h.timer.advance(2000);
    await tick();

    expect(h.recognizer.stopped).toBe(1);
    expect(h.controller.getState()).toBe("reviewing");
    h.controller.confirm();
    expect(await answer).toBe("A quiet evening");
  });

  it("holds off the silence timer while the user is still speaking", async () => {
    const h = harness({ silenceMs: 2000 });
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();

    h.recognizer.partial("I was saying");
    h.timer.advance(1500); // not yet silent
    h.recognizer.speechStart(); // still talking — cancels the pending silence
    h.timer.advance(1500); // 3s total, but the gap since last partial reset
    expect(h.recognizer.stopped).toBe(0);

    h.recognizer.partial("I was saying something longer");
    h.timer.advance(2000);
    await tick();
    expect(h.recognizer.stopped).toBe(1);
    h.controller.confirm();
    expect(await answer).toBe("I was saying something longer");
  });

  it("lets the user barge in and skip the rest of the question", async () => {
    const h = harness();
    const answer = h.controller.askUser("A very long question the user already knows");
    await tick();
    expect(h.controller.getState()).toBe("speaking");

    h.controller.skipSpeaking();
    await tick();
    expect(h.synth.stopped).toBe(1);
    expect(h.controller.getState()).toBe("listening");

    h.recognizer.final("My answer");
    await tick();
    h.controller.confirm();
    expect(await answer).toBe("My answer");
  });

  it("auto-confirms a reviewed answer left untouched", async () => {
    const h = harness({ autoConfirmMs: 4000 });
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();
    h.recognizer.final("Grateful for the quiet.");
    await tick();
    expect(h.controller.getState()).toBe("reviewing");

    h.timer.advance(4000);
    expect(await answer).toBe("Grateful for the quiet.");
  });

  it("an edit cancels the auto-confirm, so the user always wins the race", async () => {
    const h = harness({ autoConfirmMs: 4000 });
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();
    h.recognizer.final("Talked to Prya"); // misheard name
    await tick();

    h.controller.editTranscript("Talked to Priya");
    h.timer.advance(4000); // auto-confirm must NOT fire now
    let settled = false;
    void answer.then(() => (settled = true));
    await tick();
    expect(settled).toBe(false);

    h.controller.confirm();
    expect(await answer).toBe("Talked to Priya");
  });

  it("confirm can replace the answer with edited text", async () => {
    const h = harness();
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();
    h.recognizer.final("wrong words");
    await tick();

    h.controller.confirm("the right words");
    expect(await answer).toBe("the right words");
  });

  it("recovers from a recognizer error into review with what was heard", async () => {
    const h = harness();
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();

    h.recognizer.partial("half a sentence");
    h.recognizer.error("network");
    await tick();

    expect(h.events).toContainEqual({ type: "error", message: "network" });
    expect(h.controller.getState()).toBe("reviewing");
    h.controller.confirm();
    expect(await answer).toBe("half a sentence");
  });

  it("caps a single answer with the max-listen timer", async () => {
    const h = harness({ maxListenMs: 10_000 });
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();

    // Recognizer never returns anything; the cap must rescue the turn.
    h.timer.advance(10_000);
    await tick();
    expect(h.recognizer.stopped).toBe(1);
    expect(h.controller.getState()).toBe("reviewing");
    h.controller.confirm("typed instead");
    expect(await answer).toBe("typed instead");
  });

  it("cancel rejects the question and stops speech and recognition", async () => {
    const h = harness();
    const answer = h.controller.askUser("Q");
    await tick();
    h.synth.finish();
    await tick();
    expect(h.controller.getState()).toBe("listening");

    h.controller.cancel();
    await expect(answer).rejects.toBeInstanceOf(VoiceCancelledError);
    expect(h.recognizer.aborted).toBe(1);
    expect(h.controller.getState()).toBe("cancelled");
  });

  it("runs questions strictly one at a time", async () => {
    const h = harness();
    const first = h.controller.askUser("first");
    await tick();
    // askUser is async, so its guard surfaces as a rejection, not a sync throw.
    await expect(h.controller.askUser("second")).rejects.toThrow(/already in progress/);

    h.synth.finish();
    await tick();
    h.recognizer.final("done");
    await tick();
    h.controller.confirm();
    await first;

    // After the first resolves, a second question is allowed.
    const second = h.controller.askUser("second");
    await tick();
    expect(h.synth.spoken).toEqual(["first", "second"]);
    h.controller.cancel();
    await expect(second).rejects.toBeInstanceOf(VoiceCancelledError);
  });
});
