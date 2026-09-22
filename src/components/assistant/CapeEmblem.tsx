/**
 * Pelerinli S amblemi — yalnız PELERİN rüzgârda dalgalanır.
 *
 * Amblem tek parça bir görsel olduğu için harfi ayrı katman yapmak mümkün değil.
 * Bunun yerine iki kopya üst üste bindirilir:
 *   1) alt katman: hiç bozulmayan orijinal görsel (harf net kalır),
 *   2) üst katman: SVG feTurbulence + feDisplacementMap ile gerçek zamanlı
 *      kumaş dalgası uygulanan kopya; radial maske harfin bulunduğu merkezi
 *      dışarıda bırakır, yalnız pelerin alanını gösterir.
 * Böylece logo bir bütün olarak sallanmaz; yalnız pelerin hafifçe kıvrılır.
 * prefers-reduced-motion açıkken gürültü animasyonu durur.
 */
type Props = {
  src: string;
  className?: string;
  /** Dalga şiddeti (px). Hafif esinti için 6–12 arası. */
  scale?: number;
  paused?: boolean;
};

let filterSeq = 0;

export function CapeEmblem({ src, className = "", scale = 9, paused = false }: Props) {
  const filterId = `cape-wind-${(filterSeq += 1)}`;

  return (
    <span className={`relative inline-block ${className}`}>
      <svg aria-hidden="true" className="pointer-events-none absolute size-0">
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.009 0.022"
            numOctaves={2}
            seed={7}
            result="wind"
          >
            {paused ? null : (
              <animate
                attributeName="baseFrequency"
                dur="7s"
                values="0.009 0.022;0.014 0.032;0.008 0.019;0.009 0.022"
                calcMode="spline"
                keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="wind"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <img src={src} alt="" loading="lazy" className="block w-full object-contain" />

      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 block w-full object-contain cape-breeze"
        style={{ filter: `url(#${filterId})` }}
      />
    </span>
  );
}
