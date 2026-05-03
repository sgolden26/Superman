import HudLensFrame from '../components/HudLensFrame';
import HudScene from '../components/HudScene';

/**
 * The default field view: the wearer's perspective through the IVAS visor.
 *
 * Layout: a 16:9 stage is fitted to the available area using container
 * query units (cqw/cqh), so the visor and its lens content scale as one
 * piece at any window size. The lens content (a three.js canvas) is
 * positioned at the exact percentage offsets of the lens capsule in the
 * chrome SVG, then the chrome is overlaid on top.
 */
export default function HeadsUpPage() {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
      style={{ containerType: 'size' }}
    >
      <div
        className="relative"
        style={{
          width: 'min(100cqw, calc(100cqh * 16 / 9))',
          height: 'min(100cqh, calc(100cqw * 9 / 16))',
        }}
      >
        {/* lens content: sits behind the chrome, clipped to the capsule */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: '11.25%',
            top: '22.222%',
            width: '77.5%',
            height: '57.778%',
            borderRadius: '9999px',
            background: '#020617',
          }}
        >
          <HudScene />
        </div>
        <HudLensFrame />
      </div>
    </div>
  );
}
