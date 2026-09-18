/** DRL is abbreviated everywhere else in the app; every other company keeps its full name. */
export function displayCompanyName(company: string): string {
  return company === "Dr. Reddy's" ? 'DRL' : company;
}
