// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("design system components", () => {
  it("FormField links label, input and error for assistive tech", () => {
    render(
      <FormField id="email" label="Email" error={{ message: "Enter a valid email address." }}>
        {(a11y) => <Input {...a11y} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByText("Enter a valid email address.")).toHaveAttribute("id", "email-error");
  });

  it("FormField shows the hint only when there is no error", () => {
    render(
      <FormField id="pw" label="Password" hint="At least 10 characters.">
        {(a11y) => <Input {...a11y} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-describedby", "pw-hint");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });

  it("EmptyState renders title, description and action", () => {
    render(<EmptyState icon={Sparkles} title="Nothing yet" description="Add something." action={<Button>Add</Button>} />);
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("Button supports variants and asChild", () => {
    render(
      <Button asChild variant="outline">
        <a href="/x">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.className).toContain("border");
    expect(link).toHaveAttribute("data-slot", "button");
  });
});
