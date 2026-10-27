/**
 * Keeps React alive under browser page translation (pure string, unit-tested).
 *
 * Google Translate and similar tools replace the page's text nodes with their
 * own <font> elements. When React later inserts an element next to such a text
 * node (a button swapping its icon for a spinner) or removes one, the node is
 * no longer where React left it and the DOM throws NotFoundError: the whole
 * page falls into the error screen although the action behind it succeeded
 * (players who read the English site through their browser's Arabic saw this
 * after sending feedback). The guard makes those two calls tolerate a moved
 * node, the workaround from facebook/react#11538: an insert before a node that
 * has left this parent appends instead, a remove of a node that has left is
 * skipped. Calls that would have worked are untouched.
 *
 * Inserted into the server HTML before hydration (UiInit), once per document.
 */
export const DOM_GUARD_SCRIPT =
  "(function(){if(typeof Node!=='function'||Node.prototype.__kdGuard)return;var p=Node.prototype;p.__kdGuard=true;" +
  "var remove=p.removeChild;p.removeChild=function(c){if(c&&c.parentNode!==this)return c;return remove.apply(this,arguments)};" +
  "var insert=p.insertBefore;p.insertBefore=function(n,r){if(r&&r.parentNode!==this)return insert.call(this,n,null);return insert.apply(this,arguments)}})();";
