/**
 * Inline Mohar mark — drawn from the locked logo SVG paths (design board v2).
 * Colours come from theme tokens (--lg-ring / --lg-doc / --lg-key) so one
 * component covers both themes. Below 36 px it switches to the heavier
 * favicon drawing (no eyes), per the brand rules.
 */
const P = {
  ring: "M166.71 41.63A97.5 97.5 0 1 0 213.87 88.79A13.5 13.5 0 0 0 189.39 100.21A70.5 70.5 0 1 1 155.29 66.11A13.5 13.5 0 0 0 166.71 41.63Z",
  doc: "M107 99.5H134L150 115.5V154.5A6 6 0 0 1 144 160.5H107A6 6 0 0 1 101 154.5V105.5A6 6 0 0 1 107 99.5Z",
  key: "M123.19 125.51L133.35 135.67L134.23 134.78L136.92 137.47L136.04 138.35L142.47 144.79A2.25 2.25 0 0 1 139.29 147.97L132.85 141.54L131.97 142.42L129.28 139.73L130.17 138.85L120.01 128.69A9.6 9.6 0 1 1 123.19 125.51Z M110.3 120.5A4.7 4.7 0 1 0 119.7 120.5A4.7 4.7 0 1 0 110.3 120.5Z",
  seal: "M184.27 49.53A21.7 21.7 0 1 0 227.67 49.53A21.7 21.7 0 1 0 184.27 49.53Z",
  eyes: "M193.32 47.23A5.65 5.65 0 0 1 204.62 47.23A1.7 1.7 0 0 1 201.22 47.23A2.25 2.25 0 0 0 196.72 47.23A1.7 1.7 0 0 1 193.32 47.23ZM207.32 47.23A5.65 5.65 0 0 1 218.62 47.23A1.7 1.7 0 0 1 215.22 47.23A2.25 2.25 0 0 0 210.72 47.23A1.7 1.7 0 0 1 207.32 47.23Z",
  fring:
    "M166.71 41.63A97.5 97.5 0 1 0 213.87 88.79A15.75 15.75 0 0 0 185.32 102.11A66 66 0 1 1 153.39 70.18A15.75 15.75 0 0 0 166.71 41.63Z",
  fdoc: "M104.5 94H134.5L154.5 114V158A8 8 0 0 1 146.5 166H104.5A8 8 0 0 1 96.5 158V102A8 8 0 0 1 104.5 94Z",
  fkey: "M130.79 129.28L145.4 143.89A4.25 4.25 0 0 1 139.39 149.9L124.78 135.29A14.0 14.0 0 1 1 130.79 129.28Z M111.85 122.85A6.5 6.5 0 1 0 124.85 122.85A6.5 6.5 0 0 1 111.85 122.85Z",
};

export function MoharMark({
  size = 32,
  pop = false,
  label,
}: {
  size?: number;
  /** play the seal-pop animation once (funded / settled moments only) */
  pop?: boolean;
  label?: string;
}) {
  const small = size <= 36;
  return (
    <span
      className={`stamp${pop ? " pop" : ""}`}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={small ? "16 16 224 224" : "24 24 208 208"}
      >
        {small ? (
          <g transform="translate(-12.63 -12.63) scale(1.1)">
            <path fill="var(--lg-ring)" d={P.fring} />
            <path fill="var(--lg-doc)" d={P.fdoc} />
            <path fill="var(--lg-key)" fillRule="evenodd" d={P.fkey} />
            <path fill="#E8382F" d={P.seal} />
          </g>
        ) : (
          <>
            <path fill="var(--lg-ring)" d={P.ring} />
            <path fill="var(--lg-doc)" d={P.doc} />
            <path fill="var(--lg-key)" fillRule="evenodd" d={P.key} />
            <path fill="#E8382F" d={P.seal} />
            <path fill="#FFF6E9" d={P.eyes} />
          </>
        )}
      </svg>
    </span>
  );
}
