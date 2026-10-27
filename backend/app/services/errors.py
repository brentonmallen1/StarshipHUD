"""
Domain errors raised by services.

Services don't know about HTTP; routers (or the app-wide handler registered in
main.py) translate these into responses using ``status_code``.
"""


class ServiceError(Exception):
    """A request the service refuses; ``status_code`` is the HTTP status to report."""

    status_code = 400

    def __init__(self, detail: str, *, status_code: int | None = None):
        super().__init__(detail)
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(ServiceError):
    status_code = 404


class ValidationError(ServiceError):
    status_code = 422
