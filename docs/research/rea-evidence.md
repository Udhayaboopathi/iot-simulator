# REA MCP Evidence

Connector: custom.rea (morluto/rea, `rea-agents@6.7.0`, MIT), verified live
2026-11-03 in this workspace.

## Verification performed
1. `list-tools` over MCP returned the full tool catalog. Web/browser tools
   present include: `list_browser_targets`, `inspect_web_page`,
   `analyze_web_bundle`, `observe_web_session`, `capture_web_screenshot`,
   `compare_web_screenshots`, `inspect_web_network_capture`,
   `export_web_scripts`, `observe_web_execution`, `discover_webmcp_tools`.
2. A dedicated Chromium (Playwright build, Chrome/156) was launched with a
   locally bound CDP endpoint at `http://127.0.0.1:9223` and a throwaway
   profile (`/tmp/rea-profile`), then navigated to
   `https://wokwi.com/projects/266574052925456908` and `https://wokwi.com/`.
3. `list_browser_targets` succeeded against that endpoint and returned an
   evidence bundle:
   - evidence_id: `ev_a73fbe31f408a28e006cd38e39da926e8149af4da4e50ae3a22df569957b14a8`
   - target: `EC860BE64FB828BAF69BFD98EEB3F0F7`, title `wokwi.com`,
     origin `https://wokwi.com`, provider `rea-cdp-browser`, confidence
     `observed`.
4. `inspect_web_page` was then attempted on both Wokwi targets (with and
   without `allowed_origins: ["https://wokwi.com"]`). REA returned
   `target_unavailable / target_not_allowed` for both. This limitation is
   recorded as-is; no findings were fabricated from it. Page-level
   observations in `reference-analysis.md` come from the browser's own
   page-text retrieval of the same public pages, cross-checked against the
   REA-observed target metadata above.

## Boundaries respected
- Public pages only; no authentication, paywall, or technical safeguard was
  bypassed. No proprietary source, bundles, or assets were copied into this
  repository. Screenshots, where taken, were for internal comparison only
  and are not shipped.
