'use client';

import Link from 'next/link';

// Image assets from Figma
const imgImage2 = "/nava_image.png";

export default function LandingPage() {
  return (
    <div className="bg-white relative min-h-screen">
      {/* Main Content Container */}
      <div className="px-[200px] py-8">
        {/* Hero Section */}
        <div className="relative bg-[#f4e4f0] rounded-[25px] h-[351px] mb-8 overflow-hidden">
          {/* Background Images */}
          <div className="absolute inset-0">
            <div className="absolute h-[337px] top-[14px] w-[439px] right-0">
              <div className="absolute inset-0 mix-blend-normal overflow-hidden pointer-events-none opacity-80 brightness-100 contrast-110">
                <img 
                  alt="" 
                  className="absolute h-full left-[-21.65%] max-w-none top-0 w-[136.47%]" 
                  src={imgImage2} 
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 p-8 h-full flex flex-col justify-between">
            <div>
              <h1 className="font-serif text-5xl leading-tight text-black mb-4">
                Welcome!
              </h1>
              <p className="font-sans text-xl leading-6 text-black max-w-[291px]">
                Application Assistant helps you and your clients complete benefit applications faster.
              </p>
            </div>
            
            {/* Start Application Button */}
            <div className="mt-auto">
              <Link 
                href="/consent"
                className="inline-block bg-custom-purple text-white font-sans font-medium text-sm leading-6 px-7 py-2.5 rounded-lg hover:bg-custom-purple/90 transition-colors"
              >
                Start new application
              </Link>
            </div>
          </div>
        </div>

        {/* How it works Section */}
        <div className="mb-8">
          <h2 className="font-serif text-3xl leading-6 text-black mb-4">
            How it works
          </h2>
          <p className="font-sans text-lg leading-6 text-black mb-8">
                You&apos;ll see everything the AI assistant is doing, each step of the process
          </p>

          {/* Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-neutral-50 rounded-[25px] p-6 h-[244px]">
              <p className="font-mono text-xs leading-6 text-custom-purple uppercase mb-2">
                step 1
              </p>
              <h3 className="font-serif text-xl leading-6 text-black mb-4">
                Start and pre-fill
              </h3>
              <p className="font-sans text-base leading-6 text-black">
                AI agents gather what client information it can and pre-fills multiple forms for you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-neutral-50 rounded-[25px] p-6 h-[244px]">
              <p className="font-mono text-xs leading-6 text-custom-purple uppercase mb-2">
                step 2
              </p>
              <h3 className="font-serif text-xl leading-6 text-black mb-4">
                Fill in any gaps
              </h3>
              <p className="font-sans text-base leading-6 text-black">
                If information is missing, the assistant pauses and asks for your input.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-neutral-50 rounded-[25px] p-6 h-[244px]">
              <p className="font-mono text-xs leading-6 text-custom-purple uppercase mb-2">
                step 3
              </p>
              <h3 className="font-serif text-xl leading-6 text-black mb-4">
                Submit with confidence
              </h3>
              <p className="font-sans text-base leading-6 text-black">
                Once everything looks right, you submit the application—nothing is submitted automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Questions Section */}
        <div>
          <h2 className="font-serif text-3xl leading-6 text-black mb-4">
            Questions?
          </h2>
          <p className="font-sans text-lg leading-6 text-black">
            <span>Email </span>
            <a 
              href="mailto:labs@navapbc.com" 
              className="underline decoration-solid underline-offset-2 hover:text-custom-purple transition-colors"
            >
              labs@navapbc.com
            </a>
            <span className="font-bold"> </span>with any issues or feedback.
          </p>
        </div>
      </div>
    </div>
  );
}
