I want to make an LLM-powered game where you're a lawyer in a trial and the other people in the trial are NPCs controlled by LLMs.

The player is a defense attorney or prosecutor. The game starts by presenting the player with information about the case. Then the trial begins. There is a loop of cross examination where the defense attorney and prosecutor ask questions to a witness. After each question, the opposing lawyer has an opportunity to object and the judge decides whether to sustain or overrule. After cross-examination, there are closing arguments and the jury reaches a verdict.

There is initially a story generator agent that creates the true story of what happened. In addition, this agent specifies the personalities of the people of interest, their relationships between them, etc. This agent must be very detailed and create rich character backgrounds with enough information that anything asked in the trial will be answerable.

Then POI (person of interest) creator agent creates agents for each person of interest. This creator agent creates memories consistent with the true events and other information from the story generator. The POIs must only know about things they have witnessed, so this agent must be careful not to tell POIs things they shouldn't know.

A police agent decides what information is known to the lawyers in a way that is consistent with the true story, but leaves enough ambiguity/unknowns to keep the trial interesting.

Then the court character creator agent creates the judge, jury, and opposing counsel (opposite lawyer of the player) and feeds them information from the police agent. The player also receives the same information.

The judge is informed by the police agent and is also told the rules, including when objections should be sustained, etc.

It is important that POI agents are fleshed out, self-consistent, and don't hallucinate beyond the information in the true story. These agents must be able to say "i don't know" or something like that when asked for information not specified by the story generator agent.

This should be a web-app with a text-based chat-like interface for the trial.

At first, the player should see the information from the police agent and then click "ready" to start the trial. The trial should feature a chat interface. After the opposing counsel talks, the user shouldn't be able to talk freely, but instead be presented with the option to object (given a fixed set of reasons for objection) or not object. Similarly, in the questioning loop, there should be a button for no further questions. When the player may choose a witness to question, the remaining witnesses who haven't been questioned yet are selectable, and there is an option to choose not to question.

During the trial, the prosecutor first picks a witness to question. They question (direct examination) the witness and the opposing counsel cross examines. The opposing counsel may object for leading only during direct questioning. Leading is allowed during cross-examination, but scope is limited to what was addressed in direct examination (opposing counsel can object if something is out of scope in cross examination). After a witness is called, they cannot be called again. The prosecutor keeps calling witnesses until they are done. Then, the defense calls witnesses until they're done. Then closing arguments

## Rules

### sequence of trial

```
prosecutor opening statement
defense opening statement
prosecution calls witnesses
defense calls witnesses
prosecution closing statement
defense closing statement
verdict

when a witness is called:
  caller direct examines
  opposing cross examines

when a witness is examined:
  loop 10 times or until examiner has no further questions:
    examiner asks witness a question
    opposing has opportunity to object
    if objection and judge sustains:
      continue to next question
    else:
      witness answers
```

### Misc

- once a witness is called, they cannot be called again
- leading questions in direct examination may be objected, but they are allowed during cross examination
- cross examination is limited to the scope of what was covered in direct examination. questions out of scope may be objected
- the defendant may plead the 5th to avoid answering a question that will incriminate them. Witnesses must answer questions.

future ideas:
- pvp. opposing counsel is another human

todo
- [ ] organize into product high level, technical high level, rules, UX