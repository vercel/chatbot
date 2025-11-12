'use client';

import Link from 'next/link';

// Image assets from Figma
const imgImage2 = "/nava_image.png";

export default function LandingPage() {
  return (
    <div className="bg-white dark:bg-background relative min-h-screen">
      {/* Main Content Container */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-16 xl:px-32 2xl:px-[200px] py-4 sm:py-6 md:py-8">
        {/* Hero Section */}
        <div className="relative bg-[#f4e4f0] dark:bg-[#1a0b1a] rounded-[25px] h-[280px] sm:h-[320px] md:h-[351px] mb-6 sm:mb-8 overflow-hidden">
          {/* Background Images */}
          <div className="absolute inset-0">
            <div className="absolute h-[250px] sm:h-[280px] md:h-[337px] top-[14px] w-[280px] sm:w-[350px] md:w-[439px] right-0">
              <div className="absolute inset-0 mix-blend-normal overflow-hidden pointer-events-none opacity-80 brightness-100 contrast-110 dark:opacity-60 dark:brightness-75 dark:contrast-120">
                <img 
                  alt="" 
                  className="absolute h-full left-[-21.65%] max-w-none top-0 w-[136.47%]" 
                  src={imgImage2} 
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 p-4 sm:p-6 md:p-8 h-full flex flex-col justify-between">
            <div>
              <h1 className="font-source-serif text-3xl sm:text-4xl md:text-5xl leading-tight text-black dark:text-white mb-3 sm:mb-4">
                Welcome!
              </h1>
              <p className="font-inter text-base sm:text-lg md:text-xl leading-6 text-black dark:text-gray-200 max-w-[250px] sm:max-w-[291px]">
                Form-Filling Assistant helps you and your clients complete benefit applications faster.
              </p>
            </div>
            
            {/* Start Application Button */}
            <div className="mt-auto">
              <Link 
                href="/"
                className="inline-block bg-custom-purple text-white font-inter font-medium text-sm leading-6 px-6 sm:px-7 py-2 sm:py-2.5 rounded-lg hover:bg-custom-purple/90 transition-colors"
              >
                Start new application
              </Link>
            </div>
          </div>
        </div>

        {/* How it works Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="font-source-serif text-2xl sm:text-3xl leading-6 text-black dark:text-white mb-3 sm:mb-4">
            How it works
          </h2>
          <p className="font-inter text-base sm:text-lg leading-6 text-black dark:text-gray-200 mb-6 sm:mb-8">
          This tool uses artificial intelligence (AI) to help you complete applications, while you stay in control.
          </p>

          {/* Step Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Step 1 */}
            <div className="bg-neutral-50 dark:bg-muted rounded-[25px] p-4 sm:p-6 h-auto sm:h-[244px]">
              <p className="font-ibm-plex-mono text-xs leading-6 text-custom-purple uppercase mb-2">
                step 1
              </p>
              <h3 className="font-source-serif text-lg sm:text-xl leading-6 text-black dark:text-white mb-3 sm:mb-4">
                Start and autofill
              </h3>
              <p className="font-inter text-sm sm:text-base leading-6 text-black dark:text-gray-200">
              AI autofills the application for you, using client data from your case management system.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-neutral-50 dark:bg-muted rounded-[25px] p-4 sm:p-6 h-auto sm:h-[244px]">
              <p className="font-ibm-plex-mono text-xs leading-6 text-custom-purple uppercase mb-2">
                step 2
              </p>
              <h3 className="font-source-serif text-lg sm:text-xl leading-6 text-black dark:text-white mb-3 sm:mb-4">
                Fill in any gaps
              </h3>
              <p className="font-inter text-sm sm:text-base leading-6 text-black dark:text-gray-200">
                You review and complete anything that's missing. The AI only adds what's already in your system.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-neutral-50 dark:bg-muted rounded-[25px] p-4 sm:p-6 h-auto sm:h-[244px] sm:col-span-2 lg:col-span-1">
              <p className="font-ibm-plex-mono text-xs leading-6 text-custom-purple uppercase mb-2">
                step 3
              </p>
              <h3 className="font-source-serif text-lg sm:text-xl leading-6 text-black dark:text-white mb-3 sm:mb-4">
                Submit with confidence
              </h3>
              <p className="font-inter text-sm sm:text-base leading-6 text-black dark:text-gray-200">
              You submit the application once everything looks right. Nothing is submitted automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Questions Section */}
        <div>
          <h2 className="font-source-serif text-2xl sm:text-3xl leading-6 text-black dark:text-white mb-3 sm:mb-4">
            Questions?
          </h2>
          <p className="font-inter text-base sm:text-lg leading-6 text-black dark:text-gray-200">
            <span>Email </span>
            <a 
              href="mailto:labs@navapbc.com" 
              className="underline decoration-solid underline-offset-2 hover:text-custom-purple dark:hover:text-custom-purple transition-colors"
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
