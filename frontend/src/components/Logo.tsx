/** The mark: an initial on the action colour, then the wordmark. */
export const Logo = () => (
    <span className="inline-flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-action text-[15px] font-extrabold text-bg" aria-hidden="true">M</span>
        <span className="text-lg font-bold tracking-tight text-ink">MockMate</span>
    </span>
);
