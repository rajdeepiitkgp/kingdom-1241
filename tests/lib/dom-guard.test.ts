import { describe, expect, it } from "vitest";
import { DOM_GUARD_SCRIPT } from "@/lib/dom-guard";

/** A minimal Node with parent links, enough to run the guard outside a browser. */
function install() {
  class FakeNode {
    parentNode: FakeNode | null = null;
    children: FakeNode[] = [];
    constructor(public name: string) {}
    removeChild(child: FakeNode): FakeNode {
      const index = this.children.indexOf(child);
      if (index === -1) throw new Error("NotFoundError");
      this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    }
    insertBefore(node: FakeNode, ref: FakeNode | null): FakeNode {
      const index = ref ? this.children.indexOf(ref) : this.children.length;
      if (index === -1) throw new Error("NotFoundError");
      this.children.splice(index, 0, node);
      node.parentNode = this;
      return node;
    }
  }
  new Function("Node", DOM_GUARD_SCRIPT)(FakeNode);
  return FakeNode;
}

describe("DOM_GUARD_SCRIPT", () => {
  it("lets React insert next to a text node the translator has moved away (appends instead of throwing)", () => {
    const Node = install();
    const button = new Node("button");
    const text = new Node("#text");
    button.insertBefore(text, null);
    // Google Translate: the text node is swapped for its own <font>.
    const font = new Node("font");
    button.removeChild(text);
    button.insertBefore(font, null);
    const spinner = new Node("svg");
    expect(() => button.insertBefore(spinner, text)).not.toThrow();
    expect(button.children.map((c) => c.name)).toEqual(["font", "svg"]);
  });

  it("skips removing a node that has already left, and leaves normal calls alone", () => {
    const Node = install();
    const parent = new Node("p");
    const a = new Node("a");
    const b = new Node("b");
    parent.insertBefore(b, null);
    parent.insertBefore(a, b);
    expect(parent.children.map((c) => c.name)).toEqual(["a", "b"]);
    parent.removeChild(a);
    expect(() => parent.removeChild(a)).not.toThrow();
    expect(parent.children.map((c) => c.name)).toEqual(["b"]);
  });

  it("installs itself only once", () => {
    const Node = install();
    const patched = Node.prototype.insertBefore;
    new Function("Node", DOM_GUARD_SCRIPT)(Node);
    expect(Node.prototype.insertBefore).toBe(patched);
  });
});
