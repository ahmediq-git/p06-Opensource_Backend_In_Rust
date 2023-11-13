use std::sync::{Arc, Mutex};

use axum::{Extension, Json};
use ejdb::{
    bson,
    bson::ordered::OrderedDocument,
    query::{Query, Q, QH},
    Database, QueryResult,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize, Debug)]
pub struct InsertDoc {
    collection_name: String,
    field_name: String,
    field_value: Value,
}

pub async fn insert_doc(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<InsertDoc>,
) -> Json<String> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard.collection(data.collection_name).unwrap();
    let field_name = data.field_name;
    let field_value = data.field_value;
    let doc = bson! {
        field_name => field_value
    };
    let doc_id = coll.save(&doc).unwrap();
    Json(doc_id.to_string())
}

// Json structure should be like this:
// {
//     "collection_name": "Users",
//     "data": {
//       "Height": 185,
//       "Color": "Brown",
//       "Hand": "Right"
//     }
//   }
pub async fn insert_doc_multifield(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<Value>,
) -> Json<String> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard
        .collection(data["collection_name"].as_str().unwrap())
        .unwrap();
    let data = bson! {data["data"].clone()};

    let result = coll.save(data.as_document().unwrap()).unwrap();
    Json(result.to_string())
}

// Json structure should be like this:
// {
//     "collection_name": "Users",
//     "docs": {
//       "0": {
//        "Height": 185,
//        "Color": "Brown",
//        "Hand": "Right"
//       },
//       "1": {
//        "Height": 195,
//        "Color": "Brown",
//        "Hand": "Left"
//       }
//     }
//   }
pub async fn insert_docs(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<Value>,
) -> Json<Vec<String>> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard
        .collection(data["collection_name"].as_str().unwrap())
        .unwrap();
    let docs = data["docs"].as_object().unwrap();
    let mut ret_ids: Vec<String> = Vec::new();
    for (doc, data) in docs.iter() {
        let data = bson! { data.clone() };
        let doc_id = coll.save(data.as_document().unwrap()).unwrap();
        ret_ids.push(doc_id.to_string());
    }
    Json(ret_ids)
}

#[derive(Deserialize, Debug)]
pub struct GetDoc {
    collection_name: String,
    doc_id: String,
}

pub async fn read_doc(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<GetDoc>,
) -> Json<Vec<OrderedDocument>> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard.collection(data.collection_name).unwrap();
    let result = coll
        .query(Q.field("_id").eq(data.doc_id), QH.empty())
        .find()
        .unwrap();
    let mut ret_vec: Vec<OrderedDocument> = Vec::new();
    for (_x, i) in result.enumerate() {
        let x = i.unwrap();
        ret_vec.push(x);
    }
    Json(ret_vec)
}

#[derive(Deserialize, Debug)]
pub struct InsertField {
    collection_name: String,
    doc_id: String,
    field_name: String,
    field_value: Value,
}
pub async fn insert_field(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<InsertField>,
) -> Json<String> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard.collection(data.collection_name).unwrap();
    let _result = coll
        .query(
            Q.field("_id")
                .eq(data.doc_id)
                .set(data.field_name, data.field_value),
            QH.empty(),
        )
        .update()
        .unwrap();
    Json("Field Added Successfully!".to_owned())
}

#[derive(Deserialize, Debug)]
pub struct DeleteDoc {
    collection_name: String,
    doc_id: String,
}

pub async fn delete_doc(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<DeleteDoc>,
) -> Json<String> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard.collection(data.collection_name).unwrap();
    let q = Q.field("_id").eq(data.doc_id).drop_all();
    coll.query(q, QH.empty()).update().unwrap();

    Json("Document Deleted!".to_owned())
}

// Json structure should be like this:
// {
//     "collection_name": "Users",
//     "doc_id": "65019caf8526205200000000",
//     "fields_to_insert": {
//       "Height": 185,
//       "Color": "Brown",
//       "Hand": "Right"
//     }
//   }
pub async fn insert_many_fields(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<Value>,
) {
    let db_guard = db.lock().unwrap();
    let coll = db_guard
        .collection(data["collection_name"].as_str().unwrap())
        .unwrap();
    let fields_to_insert = bson! {data["fields_to_insert"].clone()};

    let _result = coll
        .query(
            Q.field("_id")
                .eq(data["doc_id"].clone())
                .set_many(fields_to_insert.as_document().unwrap().clone()),
            QH.empty(),
        )
        .update()
        .unwrap();
}

#[derive(Deserialize, Debug)]
pub struct OneFieldSearch {
    collection_name: String,
    search_key: String,
    search_value: Value,
}

pub async fn search_doc_by_one_field(
    Extension(db): Extension<Arc<Mutex<Database>>>,
    Json(data): Json<OneFieldSearch>,
) -> Json<Vec<OrderedDocument>> {
    let db_guard = db.lock().unwrap();
    let coll = db_guard.collection(data.collection_name).unwrap();
    let result = coll
        .query(Q.field(data.search_key).eq(data.search_value), QH.empty())
        .find()
        .unwrap();
    let mut ret_vec: Vec<OrderedDocument> = Vec::new();
    for (_x, i) in result.enumerate() {
        let x = i.unwrap();
        ret_vec.push(x);
    }
    Json(ret_vec)
}
