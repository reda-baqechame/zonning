@echo off
REM Opens all ZONNING setup pages — run: scripts\open-setup-links.bat

start https://vercel.com/redabaquechame58-2565s-projects/~/integrations/accept-terms/supabase?source=cli
start https://vercel.com/integrations/supabase
start https://vercel.com/integrations/upstash
start https://vercel.com/redabaquechame58-2565s-projects/zonning/settings/environment-variables
start https://resend.com/api-keys
start https://github.com/reda-baqechame/zonning/settings/secrets/actions
start https://zonning.vercel.app/api/health

echo.
echo After completing each service, tell Cursor: "done with step X"
echo Full guide: SETUP_AUTH_LINKS.md
pause
