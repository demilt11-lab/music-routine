import "@testing-library/jest-dom";
import { vi } from "vitest";

// Supabase client mock — all tests override individual methods as needed
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Navigator / Web Bluetooth stubs
Object.defineProperty(navigator, "bluetooth", {
  value: undefined,
  writable: true,
});

// Suppress console noise in tests unless explicitly tested
const originalWarn = console.warn;
const originalError = console.error;
beforeAll(() => {
  console.warn = vi.fn();
  console.error = vi.fn();
});
afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

afterEach(() => {
  vi.clearAllMocks();
});
