(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HopReachNodeFilter = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function scopesOf(props) {
    const scopes = new Set(props.observed_scopes || props.inferred_scopes || []);
    if (props.default_scope) scopes.add(props.default_scope);
    return Array.from(scopes);
  }

  function matches(props, filters) {
    const query = (filters.query || "").trim().toLocaleLowerCase();
    if (query) {
      const haystack = [props.name, props.public_key, props.status, ...scopesOf(props)]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }

    const statuses = filters.statuses || [];
    if (statuses.length && !statuses.includes(props.status)) return false;

    const scopes = filters.scopes || [];
    if (!scopes.length) return true;
    const nodeScopes = scopesOf(props);
    return scopes.some((scope) => scope === "unscoped" ? nodeScopes.length === 0 : nodeScopes.includes(scope));
  }

  return { matches, scopesOf };
});
