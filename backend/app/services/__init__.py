"""Service layer.

Each service owns one use-case area. Services compose repositories, sensors,
classifiers and other services. They never reach into HTTP or DB primitives
directly; that is the job of `api` and `db` respectively.
"""
