import { fireEvent, render, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TaskSubmitButton } from "@/components/TaskSubmitButton";

afterEach(cleanup);

it("übersteht extern ersetzten Text beim Wechsel zur Einreichung", () => {
  const onSubmit = vi.fn();
  const { getByRole, rerender } = render(<TaskSubmitButton submitting={false} onSubmit={onSubmit} />);
  const button = getByRole("button");
  // Google Translate replaces text nodes with font elements outside React.
  const label = button.querySelector("span:last-child");
  if (!label?.firstChild) throw new Error("Missing submission label");
  const translated = document.createElement("font");
  translated.textContent = "Submit assignment";
  label.replaceChild(translated, label.firstChild);
  fireEvent.click(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(() => rerender(<TaskSubmitButton submitting onSubmit={onSubmit} />)).not.toThrow();
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(() => rerender(<TaskSubmitButton submitting={false} onSubmit={onSubmit} />)).not.toThrow();
  expect(button).not.toBeDisabled();
});