/**
 * Enterprise data ratios (P/E, P/B, EV/EBITDA, EV/Sales) carries no Fy1/Fy2
 * forward-estimate columns — only Income Statement does. There is no real
 * forward-looking valuation-multiple data anywhere in the model, so this
 * section says so explicitly rather than showing fabricated numbers (the
 * reference design's own "XX.XX" placeholders were never real data either).
 * Styling matches the reference implementation's UnavailableNotice component.
 */
export function ConsensusUnavailable() {
  return (
    <section className="rounded-md border border-dashed border-[#E5C9A8] bg-[#FBF6EE] px-l py-m">
      <h3 className="m-0 text-[13px] font-semibold text-[#8A5A20]">
        Consensus Estimates — not available
      </h3>
      <p className="mt-xs mb-0 text-[12px] leading-5 text-[#8A6B3D]">
        The semantic model has no forward-looking (1YF/2YF) figures for P/E,
        P/B, EV/EBITDA, or EV/Sales. Only Income Statement carries forward
        estimates (used on the Overview tab); Enterprise data ratios does not.
      </p>
    </section>
  );
}
