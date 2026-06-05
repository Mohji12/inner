from fastapi import APIRouter

from api.v1 import (
    admin_router,
    auth_admin,
    auth_mentor,
    auth_password,
    auth_user,
    bookings,
    chat,
    meetings,
    mentor_me,
    mentors_public,
    notifications,
    reviews,
    users_me,
    file_upload,
    favorites,
    booking_reschedule,
    booking_calendar,
    waitlist,
    coach_applications,
    payments,
    wallets,
    promo_codes,
    invoices,
    marketplace,
)

api_router = APIRouter()

# Order matters: `/mentors/me` before `/mentors/{mentor_id}`
api_router.include_router(auth_user.router)
api_router.include_router(auth_mentor.router)
api_router.include_router(auth_admin.router)
api_router.include_router(auth_password.router)
api_router.include_router(admin_router.router)
api_router.include_router(users_me.router)
api_router.include_router(mentor_me.router)
api_router.include_router(mentors_public.router)
api_router.include_router(bookings.router)
api_router.include_router(booking_reschedule.router)
api_router.include_router(booking_calendar.router)
api_router.include_router(waitlist.router)
api_router.include_router(coach_applications.router)
api_router.include_router(chat.router)
api_router.include_router(meetings.router)
api_router.include_router(reviews.router)
api_router.include_router(notifications.router)
api_router.include_router(file_upload.router)
api_router.include_router(favorites.router)
api_router.include_router(payments.router)
api_router.include_router(wallets.router)
api_router.include_router(promo_codes.router)
api_router.include_router(invoices.router)
api_router.include_router(marketplace.router)
