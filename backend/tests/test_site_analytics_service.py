from services.site_analytics_service import normalize_path, referrer_host, should_skip_path, visitor_kind


def test_normalize_path_strips_url_and_caps_length():
    assert normalize_path("https://mijnlevenspad.com/mentors?x=1") == "/mentors"
    assert normalize_path("mentors") == "/mentors"
    assert normalize_path("") is None
    long_path = "/" + ("a" * 400)
    assert len(normalize_path(long_path) or "") == 255


def test_normalize_path_keeps_campaign_query():
    assert (
        normalize_path("/mentors?utm_source=instagram&utm_medium=bio&token=secret")
        == "/mentors?utm_source=instagram&utm_medium=bio"
    )
    assert normalize_path("/?ref=newsletter") == "/?ref=newsletter"


def test_skip_private_and_admin_paths():
    assert should_skip_path("/admin")
    assert should_skip_path("/admin/analytics")
    assert should_skip_path("/chat/abc")
    assert should_skip_path("/user")
    assert should_skip_path("/mentor")
    assert should_skip_path("/user/appointments")
    assert should_skip_path("/mentor/profile")
    assert not should_skip_path("/user/register")
    assert not should_skip_path("/mentor/register")
    assert not should_skip_path("/")
    assert not should_skip_path("/mentors")


def test_referrer_and_visitor_kind():
    assert referrer_host("https://google.com/search") == "google.com"
    assert referrer_host("http://localhost:5173/") is None
    assert visitor_kind("Guest") == "guest"
    assert visitor_kind("bot") is None
