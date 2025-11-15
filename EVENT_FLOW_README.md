# Event Creation Flow - Documentation

## Overview
A simplified, Apple-inspired event planning system where creators and participants use the same interface. No text inputs, only visual selections optimized for mobile and desktop.

## Features Implemented

### 1. **Unified Event Page** (`/event/[id]`)
- **Same page for everyone** - Creator and participants see the same interface
- **Copy link button** - Easy sharing with 📋 button
- **Character selection** - 8 preset characters with funny names:
  - 🐱 Cat with a Hat
  - 🦊 Clever Fox
  - 🐻 Busy Bear
  - 🐼 Chill Panda
  - 🐨 Koala Cool
  - 🦁 Brave Lion
  - 🐸 Happy Frog
  - 🦉 Wise Owl
- **Participant list** with status indicators:
  - Shows all participants with their icons and names
  - Displays each person's budget and activity preferences
  - Green "Complete" badge when questionnaire is answered
- **Simple preference survey**:
  - Budget selection (Budget 💰 / Moderate 💵 / Premium 💎)
  - Activity level slider (1-5: Laidback to Very Active)
- **Creator's difference**: Only sees "Generate Event Options" button after submitting

### 2. **Auto-Create Page** (`/create`)
- Instantly creates a new event and redirects to event page
- No city selection or other inputs needed
- Loading state with emoji

### 3. **Results Page** (`/event/[id]/results`)
- Shows 3 mock recommendations based on aggregated preferences
- Group statistics dashboard
- Participant preview with activity levels

## Simplified User Flow

**Everyone (Creator & Participants):**
```
/ (Home) → /create → Auto-redirect to /event/[id] → 
Choose Character → Set Preferences → Submit →
[Creator sees: Generate Button] 
[Participants see: Waiting message]
```

**No separate flows** - The first person to visit the event page becomes the creator automatically.

## Technical Implementation

### Database Schema (Prisma)
- `EventGroup` - Event container with invite code, city, status
- `EventGroupPreference` - Individual user preferences with session tracking

### API Routes (tRPC)
- `event.create` - Create new event
- `event.get` - Get event details
- `event.addPreferences` - Submit user preferences
- `event.markReadyToGenerate` - Mark event ready
- `event.generateRecommendations` - Generate mock recommendations

### Session Management
- Uses browser `sessionStorage` for:
  - Session ID generation
  - Creator identification
  - Preference caching
- No authentication required (anonymous by design)

## Design Philosophy

Following Apple's design principles:
- **No unnecessary text** - Visual communication first
- **One screen** - Everything fits without scrolling (where possible)
- **Simple choices** - Limited, clear options
- **No dropdowns** - All options visible and pressable
- **Smooth transitions** - Scale effects and hover states
- **Clean hierarchy** - Clear visual importance

## Dev Tools
Each page includes a dev tools panel showing:
- Event/Session IDs
- Current state
- Status information
- Participant count

## Future Enhancements

1. **AI Integration** - Replace mock recommendations with real LLM
2. **Real-time updates** - WebSocket for live preference updates
3. **Location services** - Auto-detect user city
4. **Photo uploads** - Optional event photos
5. **Calendar integration** - Save events to calendar
6. **Notification system** - Alert when recommendations ready

## Files Created/Modified

### New Files
- `/src/app/create/page.tsx` - Event creation page
- `/src/app/event/[id]/page.tsx` - Event preference page
- `/src/app/event/[id]/results/page.tsx` - Results page
- `/src/server/api/routers/event.ts` - Event API router

### Modified Files
- `/prisma/schema.prisma` - Added EventGroup and EventGroupPreference models
- `/src/server/api/root.ts` - Registered event router
- `/src/app/page.tsx` - Added "Create Event" button

## Testing

To test the flow:

1. Start the database: `./start-database.sh`
2. Run migrations: `npm run db:push`
3. Start dev server: `npm run dev`
4. Visit `http://localhost:3000`
5. Click "Create Event"
6. Select a city
7. Choose an icon and set preferences
8. Copy the link and open in another browser/incognito window
9. Set preferences as another participant
10. As creator, click "Generate Event Options"
11. View the 3 mock recommendations

## Notes

- Session storage persists per browser tab
- Creator status determined by first visitor
- Mock recommendations vary based on actual preferences
- All data stored in PostgreSQL database
- No authentication required (hackathon/demo mode)
