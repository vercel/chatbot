export function LightModeBg({
	className,
	...props
}: { className?: string } & React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 1440 1024"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			{...props}
		>
			<title>Light Mode Background</title>
			<g clipPath="url(#paint0_angular_60_14_clip_path)">
				<g transform="matrix(0.315 0.3785 -0.211795 0.176263 720 512)">
					<foreignObject
						x="-3202.17"
						y="-3202.17"
						width="6404.34"
						height="6404.34"
					>
						<div
							xmlns="http://www.w3.org/1999/xhtml"
							style={{
								background:
									"conic-gradient(from 90deg,rgba(37, 52, 65, 1) 0deg,rgba(2, 19, 34, 1) 34.2067deg,rgba(249, 251, 252, 1) 81.5435deg,rgba(163, 170, 176, 1) 237.735deg,rgba(37, 52, 65, 1) 360deg)",
								height: "100%",
								width: "100%",
								opacity: 1,
							}}
						/>
					</foreignObject>
				</g>
			</g>
			<rect
				width="1440"
				height="1024"
				data-figma-gradient-fill='{"type":"GRADIENT_ANGULAR","stops":[{"color":{"r":0.0078431377187371254,"g":0.074509806931018829,"b":0.13333334028720856,"a":1.0},"position":0.095018640160560608},{"color":{"r":0.97647058963775635,"g":0.98431372642517090,"b":0.98823529481887817,"a":1.0},"position":0.22650972008705139},{"color":{"r":0.64218562841415405,"g":0.67032945156097412,"b":0.69319838285446167,"a":1.0},"position":0.66037583351135254}],"stopsVar":[{"color":{"r":0.0078431377187371254,"g":0.074509806931018829,"b":0.13333334028720856,"a":1.0},"position":0.095018640160560608},{"color":{"r":0.97647058963775635,"g":0.98431372642517090,"b":0.98823529481887817,"a":1.0},"position":0.22650972008705139},{"color":{"r":0.64218562841415405,"g":0.67032945156097412,"b":0.69319838285446167,"a":1.0},"position":0.66037583351135254}],"transform":{"m00":630.0002441406250,"m01":-423.59042358398438,"m02":616.7949218750,"m10":757.00006103515625,"m11":352.52578735351562,"m12":-42.762973785400391},"opacity":1.0,"blendMode":"NORMAL","visible":true}'
			/>
			<defs>
				<clipPath id="paint0_angular_60_14_clip_path">
					<rect height="1024" width="1440" />
				</clipPath>
			</defs>
		</svg>
	);
}
