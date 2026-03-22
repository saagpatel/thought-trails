use std::time::Instant;

use crate::types::{ReasoningEvent, ReasoningEventType};

pub struct CotParser {
    buffer: String,
    token_index: usize,
    start_time: Instant,
    current_claim_id: Option<String>,
    thinking_started: bool,
}

impl CotParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            token_index: 0,
            start_time: Instant::now(),
            current_claim_id: None,
            thinking_started: false,
        }
    }

    /// Feed a single thinking token. Returns any completed ReasoningEvents.
    pub fn feed_thinking(&mut self, token: &str) -> Vec<ReasoningEvent> {
        let mut events = Vec::new();

        if !self.thinking_started {
            self.thinking_started = true;
            events.push(self.emit_event(ReasoningEventType::ThinkStart, String::new()));
        }

        self.buffer.push_str(token);
        self.token_index += 1;
        events.extend(self.try_segment());
        events
    }

    /// Signal that thinking phase ended. Flush buffer, emit ThinkEnd.
    pub fn finish_thinking(&mut self) -> Vec<ReasoningEvent> {
        let mut events = self.flush_buffer();
        events.push(self.emit_event(ReasoningEventType::ThinkEnd, String::new()));
        events
    }

    /// Feed a response token. Response text is not parsed into graph nodes yet.
    #[allow(clippy::unused_self)]
    pub fn feed_response(&mut self, _token: &str) -> Vec<ReasoningEvent> {
        // Phase 0: response tokens are not classified.
        // Phase 1+ could emit conclusion events from response text.
        Vec::new()
    }

    /// Signal stream complete. Flush any remaining buffer.
    pub fn finish(&mut self) -> Vec<ReasoningEvent> {
        self.flush_buffer()
    }

    fn flush_buffer(&mut self) -> Vec<ReasoningEvent> {
        let text = self.buffer.trim().to_string();
        self.buffer.clear();
        if text.len() >= 20 {
            vec![self.emit_event(classify(&text), text)]
        } else {
            Vec::new()
        }
    }

    fn try_segment(&mut self) -> Vec<ReasoningEvent> {
        let mut events = Vec::new();

        while let Some((segment, rest)) = split_first_sentence(&self.buffer) {
            self.buffer = rest;
            let trimmed = segment.trim().to_string();

            if trimmed.len() < 20 {
                continue; // Too short — discard fragment
            }

            if trimmed.len() > 300 {
                let (first, second) = force_split(&trimmed, 300);
                events.push(self.emit_event(classify(&first), first));
                // Prepend leftover back to buffer
                self.buffer = format!("{}{}", second.trim(), self.buffer);
                continue;
            }

            events.push(self.emit_event(classify(&trimmed), trimmed));
        }

        events
    }

    fn emit_event(&mut self, event_type: ReasoningEventType, text: String) -> ReasoningEvent {
        let id = uuid::Uuid::new_v4().to_string();

        let parent_id = match event_type {
            ReasoningEventType::Evidence
            | ReasoningEventType::Backtrack
            | ReasoningEventType::Conclusion => self.current_claim_id.clone(),
            _ => None,
        };

        let target_id = match event_type {
            ReasoningEventType::Backtrack => self.current_claim_id.clone(),
            _ => None,
        };

        if event_type == ReasoningEventType::Claim {
            self.current_claim_id = Some(id.clone());
        }

        ReasoningEvent {
            r#type: event_type,
            id,
            text,
            parent_id,
            target_id,
            timestamp: u64::try_from(self.start_time.elapsed().as_millis()).unwrap_or(u64::MAX),
            token_index: self.token_index,
        }
    }
}

/// Classify a text segment into a ReasoningEventType using signal-word heuristics.
/// Priority: Backtrack > Conclusion > Evidence > Claim (default).
fn classify(text: &str) -> ReasoningEventType {
    let lower = text.to_lowercase();
    let trimmed = lower.trim_start();

    // 1. Backtrack — self-corrections (highest priority)
    // Sentence-start signals to avoid mid-sentence false positives
    let backtrack_start = [
        "wait,",
        "wait ",
        "but wait",
        "hmm,",
        "hmm ",
        "actually,",
        "actually ",
        "no,",
        "hold on",
        "oops",
        "let me reconsider",
        "let me rethink",
    ];
    if backtrack_start.iter().any(|s| trimmed.starts_with(s)) {
        return ReasoningEventType::Backtrack;
    }
    // Anywhere-in-sentence signals (highly unambiguous)
    let backtrack_anywhere = [
        "that's wrong",
        "that's not right",
        "i made an error",
        "i made a mistake",
        "that doesn't work",
        "that can't be right",
    ];
    if backtrack_anywhere.iter().any(|s| lower.contains(s)) {
        return ReasoningEventType::Backtrack;
    }

    // 2. Conclusion — synthesis signals
    let conclusion_start = [
        "therefore",
        "thus,",
        "thus ",
        "hence,",
        "in conclusion",
        "in summary",
        "so the answer",
        "the final answer",
        "the answer is",
        "we can conclude",
    ];
    if conclusion_start.iter().any(|s| trimmed.starts_with(s)) {
        return ReasoningEventType::Conclusion;
    }

    // 3. Evidence — supporting reasoning (high-reliability signals only)
    let evidence_signals = [
        "because",
        "since ",
        "for example",
        "specifically",
        "given that",
        "we know that",
        "this means",
        "this implies",
        "which means",
        "substituting",
    ];
    if evidence_signals.iter().any(|s| lower.contains(s)) {
        return ReasoningEventType::Evidence;
    }

    // 4. Default: Claim (new assertion or reasoning step)
    ReasoningEventType::Claim
}

/// Split buffer at the first sentence boundary.
/// Returns (sentence, rest) or None if no complete sentence found.
fn split_first_sentence(text: &str) -> Option<(String, String)> {
    let bytes = text.as_bytes();
    let len = bytes.len();

    // Check for \n\n boundary first
    if let Some(pos) = text.find("\n\n") {
        let sentence = text[..pos].to_string();
        let rest = text[pos + 2..].to_string();
        if !sentence.trim().is_empty() {
            return Some((sentence, rest));
        }
    }

    // Check for ". ", "? ", "! " followed by uppercase letter or newline
    for i in 0..len.saturating_sub(1) {
        let ch = bytes[i];
        if (ch == b'.' || ch == b'?' || ch == b'!') && i + 1 < len {
            let next = bytes[i + 1];
            if next == b' ' || next == b'\n' {
                // Check if character after space is uppercase (or end of reasonable text)
                if i + 2 < len {
                    let after = bytes[i + 2];
                    if after.is_ascii_uppercase()
                        || after == b'\n'
                        || after == b'('
                        || after == b'['
                    {
                        let sentence = text[..=i].to_string();
                        let rest = text[i + 1..].trim_start().to_string();
                        return Some((sentence, rest));
                    }
                }
                // Also split at ". \n" patterns
                if next == b'\n' {
                    let sentence = text[..=i].to_string();
                    let rest = text[i + 2..].to_string();
                    return Some((sentence, rest));
                }
            }
        }
    }

    None
}

/// Force-split text at nearest sentence boundary before max_len,
/// or at nearest space if no sentence boundary found.
fn force_split(text: &str, max_len: usize) -> (String, String) {
    let search_region = &text[..max_len.min(text.len())];

    // Try to find last sentence boundary
    for (i, ch) in search_region.char_indices().rev() {
        if (ch == '.' || ch == '?' || ch == '!') && i > 20 {
            return (text[..=i].to_string(), text[i + 1..].to_string());
        }
    }

    // Fallback: split at last space
    if let Some(pos) = search_region.rfind(' ') {
        if pos > 20 {
            return (text[..pos].to_string(), text[pos + 1..].to_string());
        }
    }

    // Last resort: hard split
    (text[..max_len].to_string(), text[max_len..].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper: feed a full sentence and return the classified event type
    fn classify_sentence(text: &str) -> ReasoningEventType {
        classify(text)
    }

    // Helper: extract thinking text from a fixture NDJSON file
    fn load_fixture_thinking(filename: &str) -> String {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("fixtures/deepseek-samples")
            .join(filename);
        let content = std::fs::read_to_string(&path)
            .unwrap_or_else(|_| panic!("Failed to read fixture: {}", path.display()));

        let mut thinking = String::new();
        for line in content.lines() {
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(t) = obj.get("thinking").and_then(|v| v.as_str()) {
                    thinking.push_str(t);
                }
            }
        }
        thinking
    }

    // ---- Classification tests ----

    #[test]
    fn test_classify_backtrack_wait_comma() {
        assert_eq!(
            classify_sentence("Wait, that doesn't seem right."),
            ReasoningEventType::Backtrack
        );
    }

    #[test]
    fn test_classify_backtrack_but_wait() {
        assert_eq!(
            classify_sentence("But wait, if both a and b are even, they share a common factor."),
            ReasoningEventType::Backtrack
        );
    }

    #[test]
    fn test_classify_backtrack_oops() {
        assert_eq!(
            classify_sentence("Oops, I think I miscalculated the sum."),
            ReasoningEventType::Backtrack
        );
    }

    #[test]
    fn test_classify_backtrack_hmm() {
        assert_eq!(
            classify_sentence("Hmm, let me reconsider this approach."),
            ReasoningEventType::Backtrack
        );
    }

    #[test]
    fn test_classify_evidence_because() {
        assert_eq!(
            classify_sentence("This works because the sum of two even numbers is always even."),
            ReasoningEventType::Evidence
        );
    }

    #[test]
    fn test_classify_evidence_since() {
        assert_eq!(
            classify_sentence(
                "Since the bat costs $1.00 more than the ball, we can write bat = ball + 1."
            ),
            ReasoningEventType::Evidence
        );
    }

    #[test]
    fn test_classify_evidence_for_example() {
        assert_eq!(
            classify_sentence("For example, fib(0) = 0 and fib(1) = 1 are the base cases."),
            ReasoningEventType::Evidence
        );
    }

    #[test]
    fn test_classify_conclusion_therefore() {
        assert_eq!(
            classify_sentence("Therefore, the ball costs $0.05."),
            ReasoningEventType::Conclusion
        );
    }

    #[test]
    fn test_classify_conclusion_answer() {
        assert_eq!(
            classify_sentence("So the answer is that all Bloops are indeed Lazzles."),
            ReasoningEventType::Conclusion
        );
    }

    #[test]
    fn test_classify_claim_default() {
        assert_eq!(
            classify_sentence("Let's define the variables for this problem."),
            ReasoningEventType::Claim
        );
    }

    // ---- Segmentation tests ----

    #[test]
    fn test_segment_min_length() {
        let mut parser = CotParser::new();
        // Feed a short fragment followed by a real sentence
        let events = parser.feed_thinking("So. Let's define the variables for this problem. ");
        // "So." is < 20 chars, should be discarded
        // "Let's define the variables for this problem." is >= 20, should be emitted
        let non_boundary_events: Vec<_> = events
            .iter()
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        // The short fragment "So." should have been discarded
        for event in &non_boundary_events {
            assert!(
                event.text.len() >= 20 || event.text.is_empty(),
                "Event text too short: {:?} ({})",
                event.text,
                event.text.len()
            );
        }
    }

    #[test]
    fn test_segment_max_length() {
        let mut parser = CotParser::new();
        let long_text = "A".repeat(200) + ". " + &"B".repeat(200) + ". Done with this test now.";
        let events = parser.feed_thinking(&long_text);
        let finish_events = parser.finish_thinking();
        let all_events: Vec<_> = events
            .into_iter()
            .chain(finish_events)
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        for event in &all_events {
            if !event.text.is_empty() {
                assert!(
                    event.text.len() <= 320, // Some tolerance for force-split
                    "Event text too long: {} chars",
                    event.text.len()
                );
            }
        }
    }

    // ---- Structural tests ----

    #[test]
    fn test_parent_linking() {
        let mut parser = CotParser::new();

        // Feed a claim, then evidence, then backtrack
        let mut all_events = Vec::new();
        all_events.extend(parser.feed_thinking("Let's define the variables for this problem. "));
        all_events.extend(
            parser.feed_thinking("This works because the sum of two even numbers is always even. "),
        );
        all_events.extend(parser.feed_thinking("Wait, that doesn't seem right for our case. "));
        all_events.extend(parser.finish_thinking());

        // Filter out ThinkStart/ThinkEnd
        let content_events: Vec<_> = all_events
            .iter()
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        assert!(
            content_events.len() >= 3,
            "Expected at least 3 events, got {}",
            content_events.len()
        );

        let claim = &content_events[0];
        let evidence = &content_events[1];
        let backtrack = &content_events[2];

        assert_eq!(claim.r#type, ReasoningEventType::Claim);
        assert_eq!(evidence.r#type, ReasoningEventType::Evidence);
        assert_eq!(backtrack.r#type, ReasoningEventType::Backtrack);

        // Evidence and backtrack should link to the claim
        assert_eq!(evidence.parent_id, Some(claim.id.clone()));
        assert_eq!(backtrack.parent_id, Some(claim.id.clone()));
        assert_eq!(backtrack.target_id, Some(claim.id.clone()));

        // Claim should have no parent
        assert_eq!(claim.parent_id, None);
    }

    #[test]
    fn test_incremental_feeding() {
        let mut parser = CotParser::new();
        let tokens = [
            "Wait", ",", " that", " doesn't", " seem", " right.", " Let's", " try", " again.", " ",
        ];

        let mut all_events = Vec::new();
        for token in &tokens {
            all_events.extend(parser.feed_thinking(token));
        }
        all_events.extend(parser.finish_thinking());

        let content_events: Vec<_> = all_events
            .iter()
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        assert!(
            !content_events.is_empty(),
            "Expected at least one event from incremental feeding"
        );

        // First event should be a backtrack (starts with "Wait,")
        assert_eq!(
            content_events[0].r#type,
            ReasoningEventType::Backtrack,
            "First event should be Backtrack, got {:?}",
            content_events[0].r#type
        );
    }

    // ---- Fixture integration tests ----

    #[test]
    fn test_fixture_sample_01_math() {
        let thinking = load_fixture_thinking("sample-01-math-bat-ball.ndjson");
        assert!(!thinking.is_empty(), "Fixture thinking text is empty");

        let mut parser = CotParser::new();
        let mut all_events = Vec::new();
        // Simulate token-by-token feeding (split on spaces to approximate)
        for word in thinking.split_inclusive(' ') {
            all_events.extend(parser.feed_thinking(word));
        }
        all_events.extend(parser.finish_thinking());

        let content_events: Vec<_> = all_events
            .iter()
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        // Sample 01 has ~9 sentences, ~546 chars thinking
        assert!(
            content_events.len() >= 3,
            "Expected at least 3 events from sample-01, got {}",
            content_events.len()
        );
        assert!(
            content_events.len() <= 20,
            "Expected at most 20 events from sample-01, got {}",
            content_events.len()
        );

        // Should contain at least one claim
        assert!(
            content_events
                .iter()
                .any(|e| e.r#type == ReasoningEventType::Claim),
            "Expected at least one Claim event"
        );
    }

    #[test]
    fn test_fixture_sample_04_coding() {
        let thinking = load_fixture_thinking("sample-04-coding-fibonacci.ndjson");
        assert!(!thinking.is_empty(), "Fixture thinking text is empty");

        let mut parser = CotParser::new();
        let mut all_events = Vec::new();
        for word in thinking.split_inclusive(' ') {
            all_events.extend(parser.feed_thinking(word));
        }
        all_events.extend(parser.finish_thinking());

        let content_events: Vec<_> = all_events
            .iter()
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        // Sample 04 has ~83 sentences, should produce many events
        assert!(
            content_events.len() >= 10,
            "Expected at least 10 events from sample-04, got {}",
            content_events.len()
        );

        // Should contain backtracks (sample has "Wait, but sometimes people start...")
        assert!(
            content_events
                .iter()
                .any(|e| e.r#type == ReasoningEventType::Backtrack),
            "Expected at least one Backtrack event in sample-04"
        );
    }

    #[test]
    fn test_fixture_sample_07_multi_hop() {
        let thinking = load_fixture_thinking("sample-07-multi-hop-bloops.ndjson");
        assert!(!thinking.is_empty(), "Fixture thinking text is empty");

        let mut parser = CotParser::new();
        let mut all_events = Vec::new();
        for word in thinking.split_inclusive(' ') {
            all_events.extend(parser.feed_thinking(word));
        }
        all_events.extend(parser.finish_thinking());

        let content_events: Vec<_> = all_events
            .iter()
            .filter(|e| {
                e.r#type != ReasoningEventType::ThinkStart
                    && e.r#type != ReasoningEventType::ThinkEnd
            })
            .collect();

        // Sample 07 has ~42 sentences
        assert!(
            content_events.len() >= 5,
            "Expected at least 5 events from sample-07, got {}",
            content_events.len()
        );

        // Should have a mix of types (not all claims)
        let types: std::collections::HashSet<_> =
            content_events.iter().map(|e| &e.r#type).collect();
        assert!(
            types.len() >= 2,
            "Expected at least 2 different event types, got {:?}",
            types
        );
    }
}
