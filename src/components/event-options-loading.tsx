import { Loader } from "./ui/loader";

const EventOptionsLoading = () => {
  return (
    <div className="flex items-center text-white flex-col gap-4 justify-center h-52 w-full rounded-xl bg-[#029DE2] animate-pulse-gradient" >
      <Loader />
      Generating recommendations...
    </div>
  );
};

export default EventOptionsLoading;