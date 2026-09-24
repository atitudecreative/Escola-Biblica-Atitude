import { ShowcaseSkeleton } from "@/components/home/course-showcase";

export default function HomeLoading() {
  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-8" aria-busy="true" aria-label="Carregando a página inicial">
      <div className="skeleton h-[420px] rounded-[1.25rem] lg:h-[400px]" />
      <div className="mt-14 lg:mt-16">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton mt-3 mb-6 h-7 w-80 max-w-full" />
        <ShowcaseSkeleton />
      </div>
    </div>
  );
}
