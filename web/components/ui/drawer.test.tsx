import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DrawerBody, DrawerFooter, DrawerHeader } from "./drawer";

/**
 * These pin the layout contract that makes a long list inside a drawer
 * scrollable on a phone. The failure they guard against is not subtle in use —
 * the stop list would not scroll at all and the Calculate button was pushed
 * off the bottom of the screen — but it is invisible in a type check.
 */
describe("DrawerBody", () => {
  const html = renderToStaticMarkup(<DrawerBody />);

  it("is the scroll container itself", () => {
    // A ScrollArea here sizes its viewport with height:100%, which does not
    // resolve against a flex item, so nothing ever overflows.
    expect(html).toContain("overflow-y-auto");
  });

  it("can shrink below its content height", () => {
    expect(html).toContain("min-h-0");
    expect(html).toContain("grow");
  });

  it("does not use a zero flex basis", () => {
    // basis-0 collapses the body to nothing inside the h-auto drawer when the
    // list is short.
    expect(html).not.toContain("basis-0");
  });

  it("opts out of vaul's drag handling", () => {
    // Without this, vaul treats a touch scroll as a drag on the sheet and the
    // list will not move under a finger.
    expect(html).toContain("data-vaul-no-drag");
  });

  it("does not chain scrolling to the page behind it", () => {
    expect(html).toContain("overscroll-contain");
  });

  it("keeps caller classes", () => {
    expect(renderToStaticMarkup(<DrawerBody className="px-4" />)).toContain(
      "px-4"
    );
  });
});

describe("drawer header and footer", () => {
  it("cannot be squeezed by a long body", () => {
    // Both sit either side of the scroll area; if they shrink, the footer's
    // action can be pushed out of reach.
    expect(renderToStaticMarkup(<DrawerHeader />)).toContain("shrink-0");
    expect(renderToStaticMarkup(<DrawerFooter />)).toContain("shrink-0");
  });
});
