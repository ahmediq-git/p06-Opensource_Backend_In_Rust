pub mod auth;
pub mod router;
pub mod utils {
    pub mod auth;
    pub mod jwt;
}

pub mod apis {
    pub mod auth;
    pub mod auth_test;
    pub mod collection;
    pub mod collection_test;
    pub mod document;
    pub mod document_test;
    pub mod logs;
    pub mod logs_test;
}
pub mod middleware {
    pub mod auth;
    pub mod tracer;
}
