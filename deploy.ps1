# Deployment script for Vercel

# Ensure all dependencies are installed
npm install

# Install Vercel CLI if not already installed
npm install -g vercel

# Deploy to Vercel
Write-Host "Deploying to Vercel..."
vercel --prod

Write-Host "Deployment complete! Your application should be available at https://mes-ruddy.vercel.app"
Write-Host "Note: You may need to log in to Vercel if prompted."