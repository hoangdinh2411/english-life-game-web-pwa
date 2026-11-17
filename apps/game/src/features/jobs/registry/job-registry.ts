import type { JobDefinition } from "@life-abroad/shared";

export const REGISTERED_JOBS: Record<string, JobDefinition> = {
  job_ice_cream: {
    id: "job_ice_cream",
    industry: "hospitality_fb",
    archetype: "assembly",
    title: "Ice Cream Artisan",
    stationName: "Sweet Scoops Kiosk",
    description: "Listen to customer orders and assemble scoops on a cone or cup.",
    supportedModes: ["kid", "adult"],
  },
  job_barista: {
    id: "job_barista",
    industry: "hospitality_fb",
    archetype: "assembly",
    title: "Café Barista",
    stationName: "Corner Café",
    description: "Prepare customized coffee and tea drinks according to customer taste.",
    supportedModes: ["kid", "adult"],
  },
  job_post_office: {
    id: "job_post_office",
    industry: "logistics_transport",
    archetype: "sorting",
    title: "Mail Dispatcher",
    stationName: "Central Post Office",
    description: "Sort letters and packages into the correct destination bins by address.",
    supportedModes: ["adult"],
  },
};

export function getJobDefinition(jobId: string): JobDefinition | undefined {
  return REGISTERED_JOBS[jobId];
}
