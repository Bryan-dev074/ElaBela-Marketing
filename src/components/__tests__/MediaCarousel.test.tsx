import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { MediaCarousel } from "@/components/MediaCarousel";

const images = ["one.jpg", "two.jpg", "three.jpg"];

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe("MediaCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("autoplays every 1500 ms and supports manual previous navigation", async () => {
    render(<MediaCarousel images={images} alt="Ejemplo" />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Imagen anterior" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("offers an accessible pause and resume control", async () => {
    render(<MediaCarousel images={images} alt="Ejemplo" />);

    fireEvent.click(screen.getByRole("button", { name: "Pausar carrusel" }));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reanudar carrusel" }));
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("pauses autoplay while hovered or focused", async () => {
    render(<MediaCarousel images={images} alt="Ejemplo" />);
    const carousel = screen.getByRole("region", { name: "Carrusel de Ejemplo" });

    fireEvent.mouseEnter(carousel);
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.mouseLeave(carousel);
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    const next = screen.getByRole("button", { name: "Imagen siguiente" });
    fireEvent.focus(next);
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.blur(next);
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("defers autoplay for a full interval after manual navigation", async () => {
    render(<MediaCarousel images={images} alt="Ejemplo" />);

    await act(async () => vi.advanceTimersByTimeAsync(1400));
    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1499));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("stays paused while an expanded inspection is active", async () => {
    render(<MediaCarousel images={images} alt="Ejemplo" paused />);

    await act(async () => vi.advanceTimersByTimeAsync(3000));

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("does not autoplay when reduced motion is requested", async () => {
    mockReducedMotion(true);
    render(<MediaCarousel images={images} alt="Ejemplo" />);

    await act(async () => vi.advanceTimersByTimeAsync(3000));

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("opens the active image index", () => {
    const onOpen = vi.fn();
    render(<MediaCarousel images={images} alt="Ejemplo" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));
    fireEvent.click(screen.getByRole("img", { name: "Ejemplo 2" }));

    expect(onOpen).toHaveBeenCalledWith(1);
  });
});
