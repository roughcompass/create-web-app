import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetTestData, server } from "./server";

class ResizeObserverStub {
	observe(target: Element): void { void target; }
	unobserve(target: Element): void { void target; }
	disconnect(): void { /* no observed resources */ }
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

beforeAll(() => { server.listen({ onUnhandledFrame: "error" }); });
afterEach(() => { resetTestData(); });
afterAll(() => { server.close(); });