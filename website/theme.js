// Default fallback theme (used while Supabase loads)
const FALLBACK_THEME = "light-nature";
document.documentElement.setAttribute('data-theme', FALLBACK_THEME);

// Fetch live theme from Supabase
(async function() {
  try {
    const SB_URL = "https://kwsubbcefpmzbctgtjnu.supabase.co";
    const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3c3ViYmNlZnBtemJjdGd0am51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDE3MzMsImV4cCI6MjA4NjcxNzczM30.YJrjmO3T7b3qnWQEQUHiPNyosX8YNM3CqUvbu3hwqMk";
    const res = await fetch(SB_URL + "/rest/v1/site_config?key=eq.website_theme&select=value", {
      headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && data[0].value) {
        document.documentElement.setAttribute('data-theme', data[0].value);
      }
    }
  } catch(e) {}
})();
