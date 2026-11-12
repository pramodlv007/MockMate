import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { RubricDemo } from './RubricDemo';
import { useHeroEntrance } from '../lib/motion';

/**
 * Sign-in and sign-up share one first screen: what MockMate is, said plainly, beside the product
 * working (the graded sample answer). On a phone the product drops away and the form follows the h1.
 */
export const AuthShell = ({ children }: { children: ReactNode }) => {
    useHeroEntrance();
    return (
        <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="hero ground-lit relative overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r" data-enter aria-labelledby="auth-hero-h">
                <div className="ground-grid pointer-events-none absolute inset-0" aria-hidden="true" />
                <div className="relative mx-auto flex h-full w-full max-w-xl flex-col justify-center gap-6 px-6 pb-6 pt-10 sm:px-10 lg:gap-8 lg:py-16">
                    <Logo />
                    <h1 id="auth-hero-h" className="text-[2.1rem] font-extrabold leading-[1.08] sm:text-5xl">
                        Mock interviews for software engineers
                    </h1>
                    <p className="max-w-md text-base text-soft sm:text-lg">
                        Answer out loud. Each behavioral answer is checked against six rubric points, and every
                        point you hit is quoted back from what you said.
                    </p>
                    <RubricDemo className="hero__window hidden lg:block" />
                </div>
            </section>

            {/* App wraps every page in <main id="main">, so this column is a plain box */}
            <div className="flex items-center justify-center px-6 py-10 sm:px-10">
                <div className="w-full max-w-md">
                    {children}
                    <p className="mt-8 text-center text-sm text-muted"><Link to="/privacy" className="link">How we handle your data</Link></p>
                </div>
            </div>
        </div>
    );
};
