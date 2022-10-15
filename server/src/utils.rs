pub fn random_token(validate_token: impl Fn(&str) -> bool) -> String {
    use rand::distributions::{Alphanumeric, DistString};
    loop {
        let token = Alphanumeric.sample_string(&mut rand::thread_rng(), 24);
        if validate_token(&token) {
            return token;
        }
    }
}
