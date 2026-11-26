-- Follow-ups for every speed-friending and custom question (3 each).
-- One line per question: id|follow-up 1|follow-up 2|follow-up 3

update public.friending_questions t
set follow_ups = (string_to_array(d.line, '|'))[2:4]
from unnest(string_to_array($fu$1|Who makes it?|When do you eat it?|Can you cook it?
2|Why?|Did you eat it as a child?|Does your family like it?
3|What do you have in that colour?|Is it in your room?|What colour do you not like?
4|When did you last feel happy?|Who makes you happy?|Does it cost money?
5|Why?|Do you have a pet?|What is its name?
6|Who sings it?|When do you listen to it?|Can you sing it?
7|Who do you talk to?|Does it help?|What makes you sad?
8|Why?|What do you do on rainy days?|What is your favourite weather?
9|Why?|What do you do on that day?|What day do you not like?
10|Why?|Are you scared of it?|What animal do you love?
61|Why?|When did you last go there?|Who do you go with?
62|Why?|What do you want to see there?|Who do you want to go with?
63|Why?|What do you wear in hot weather?|What is the weather like today?
64|Why?|Did you see one in real life?|Is it big or small?
65|Who do you walk with?|Is there a park near your home?|What do you see there?
66|What is its name?|Did you go there?|What can you do there?
67|Why?|Where did you go by train or plane?|Are you scared of planes?
68|What is in it?|Do you like flowers?|Who looks after it?
69|Do you like it?|What do you wear today?|What is the best month there?
70|Why?|Can you swim well?|Is the water cold?
121|What time do you eat it?|Who makes it?|What did you eat today?
122|Why?|How many cups a day?|Do you put sugar in it?
123|Why?|Do you eat it every day?|What fruit do you not like?
124|What can you cook?|Who cooks in your family?|What do you want to learn to cook?
125|Do you like it?|Can you make it?|Where can I eat it?
126|What is your favourite pizza?|Where do you eat pizza?|Can you make pizza?
127|Why?|How much do you drink?|What do you drink in the morning?
128|What sweet food do you like?|When do you eat it?|Is it good for you?
129|Why?|What do you eat there?|Who do you go with?
130|Why?|What is your favourite meat or fish?|Do you have a vegetarian friend?
181|Why?|What does he or she do?|Do you want to be like them?
182|Why are they famous?|Do you like them?|Did you see them in real life?
183|What is your favourite song by them?|Why do you like them?|Did you see them in concert?
184|Why?|What do you do together?|How old are they?
185|What is your favourite film with them?|Why do you like them?|Is there an actor you don't like?
186|Why are they funny?|Where do they live?|Are you funny too?
187|What sport do they play?|Why do you like them?|Do you play that sport?
188|Why?|What do you talk about?|Do you talk in person or on the phone?
189|How old are they?|Where do they live?|Do you see them often?
190|Why are they kind?|How do you know them?|Are you kind to them too?
241|Do you like it?|Is it big or small?|Where do you want to live?
242|What is your favourite room?|Do you have your own room?|Is it a big home?
243|Why?|What is in it?|What do you do there?
244|Was it easy to guess?|Which one was the most fun?|Can you guess my false one?
245|Do you like the colour?|What is in your bedroom?|What colour do you want?
246|Who do you live with?|Do you like it?|Where do you want to live?
247|What is your favourite thing in it?|Is it big or small?|Who cooks there?
248|What can you see from it?|Is it in your bedroom?|Do you like the view?
249|Do you go there often?|Is there a shop?|Is it quiet or noisy?
250|What is your favourite thing about it?|What do you want to change?|Is it near your school?
301|How many people?|Who do you talk to most?|Who is the funniest?
302|How old are they?|What are their names?|Do you play together?
303|Why?|What do you do together?|Where do they live?
304|Where do you go?|When do you see them?|What did you do last time?
305|What is its name?|What pet do you want?|Who looks after it?
306|Why?|How long do you talk?|Do you like phone calls?
307|When?|How old were you?|What did you do?
308|Why?|Are they like you?|What do they like about you?
309|What time do you eat?|What do you talk about?|Who cooks?
310|Why?|Is your family big or small?|How many children do you want?
361|Who with?|What did you do last weekend?|What do you want to do this weekend?
362|What sport do you like?|Do you play or watch?|Who is your favourite player?
363|When did you start?|How often do you do it?|Is it expensive?
364|What is your favourite film?|Who do you watch with?|Do you like funny or scary films?
365|What time do you go to bed?|Do you watch TV?|What did you do last night?
366|Which one?|Who taught you?|Do you want to learn one?
367|What do you read?|When do you read?|What is your favourite book?
368|Why?|Do you get up late?|Who do you see on Sunday?
369|Who do you go with?|What did you see last time?|Do you eat popcorn?
370|Why?|Who do you play with?|Do you play on your phone?
421|How long does it take?|Do you like it?|Who comes with you?
422|Why?|Who do you go with?|What do you do there?
423|Why?|Is it cheap?|How often do you take it?
424|Why?|How often do you go there?|Can I go there too?
425|What colour is it?|Where do you ride it?|Is it new or old?
426|Why?|Who with?|How do you get there?
427|Where do you walk?|Who do you walk with?|How long do you walk?
428|What do you drink there?|Is it cheap?|Who do you go with?
429|Why?|What is your favourite big city?|Do you live in a big city?
430|Why?|What do you do there?|When did you last go?
11|Who do you do it with?|How long have you done it?|Did you do it last weekend?
12|Why do you hate it?|Who does it in your home?|What housework do you not mind?
13|Who were you with?|Do you laugh a lot?|Who makes you laugh the most?
14|Where do you sing it?|Who sings it?|Do you know all the words?
15|Why were you afraid?|Are you still afraid of it?|What are you afraid of now?
16|Who gave it to you?|How old were you?|Do you still have it?
17|What do you do when it happens?|Does it happen every day?|What makes the journey nicer?
18|Why do you like it?|Where do you smell it?|What smell do you hate?
19|What do you do in that season?|What do you wear then?|Which season do you like the least?
20|How often do you do it?|Where do you do it?|What makes you stressed?
71|Who did you go with?|What did you do there?|Would you go there again?
72|When did you go there?|What did you do there?|Did you take photos?
73|Why?|What was your best city holiday?|What do you do in the countryside?
74|Why?|Have you ever forgotten something important?|Do you pack a big or small bag?
75|Where did you camp?|Did you sleep well?|Would you do it again?
76|Why?|Where does it live?|Have you seen it in a zoo?
77|Where did you go?|How did you travel?|What did you do on the journey?
78|Why?|Where did you go with friends?|Would you like to travel alone?
79|Was it hot or cold?|Where was it?|Did the weather change your plans?
80|Why there?|Who would you go with?|What would you do there?
131|Who cooked it?|Was it good?|What will you eat tonight?
132|When did you last eat it?|Can you buy it here?|Who makes it best?
133|Who taught you?|What is your best dish?|What would you like to learn to cook?
134|Where did you eat it?|Did you like it?|Would you eat it again?
135|Why?|How often do you eat out?|What is your favourite restaurant?
136|Why don't you eat it now?|Who made it for you?|Do you miss it?
137|Do you eat it every day?|What time do people eat it?|Is it healthy?
138|When do you eat it?|Is it healthy?|How often do you eat it?
139|What did you try?|Where did you eat it?|Would you eat it again?
140|Which special days?|Who cooks it?|What is your favourite?
191|How do you know about them?|What do you want to learn from them?|Have you met them?
192|Who was it?|Where did you meet them?|What did you say?
193|Why?|What did they teach?|Do you remember a lesson with them?
194|What are they good at?|How did they learn it?|Are you good at it too?
195|Why?|What would you ask them?|What would you eat together?
196|How did they help you?|Do you still see them?|Did you say thank you?
197|Why are they interesting?|Where did you meet them?|What do they do?
198|What was your favourite song?|Did you see them in concert?|Do you still listen to them?
199|Why are they brave?|What did they do?|Are you brave too?
200|Why?|What would you ask them?|What did they do?
251|Why?|Where did you get it?|How long have you had it?
252|Where was it?|What was your favourite room?|Do you miss it?
253|Was it easy to guess?|Which fact was the most surprising?|Do you want to guess my facts?
254|Why?|How much would it cost?|What do you like about it now?
255|Why?|Where do you live now?|What is good about small towns?
256|Why or why not?|Do you share jobs at home?|Who would you like to live with?
257|Where is it?|How many rooms does it have?|What is the best part?
258|Where?|How long did you live there?|What was different?
259|Who are you with?|Do you watch TV?|Do you like rainy days?
260|Why?|Who tidies it?|Is it tidy now?
311|How old were you?|Where were you?|What did you do together?
312|How often do you do it?|What did you do last time?|Who in your family is the most fun?
313|Why?|Are you a good friend?|Do you have a friend like that?
314|What do you have the same?|Do people say you look like them?|Are you like them in other ways?
315|Why?|How often do you talk to them?|When will you see them?
316|Where did you meet them?|What do you do together?|Is it easy to make friends here?
317|Where did you play?|What games did you play?|Do you still see them?
318|Why?|Where do you go?|How many people is too many?
319|When was it?|How did you feel?|Did you do something nice for them?
320|What was their name?|What did you do together?|Are you still friends?
371|Who were you with?|Did you have fun?|Was it a normal weekend for you?
372|What time do you get up?|Who is with you?|What do you eat?
373|Why did you stop?|Do you still do it?|Who did it with you?
374|Why?|Do you watch it on TV or live?|Which team do you like?
375|What was it about?|Who did you watch it with?|Would you watch it again?
376|Why?|What do you do at night?|What did you do last Friday?
377|Who with?|Where will you go?|Do you need to work too?
378|Who did you go with?|How did you get there?|Would you go again?
379|Why?|Where can you learn it?|Is it expensive?
380|How often do you do it?|Does it always work?|When do you need to relax?
431|Why?|What did you do there?|Who did you go with?
432|How long did it take?|Was it a good journey?|What did you do on the way?
433|Why there?|What would you do there?|Is it cheap or expensive?
434|What do you buy there?|Is it expensive?|How often do you go?
435|Which city?|What did you do there?|Did you like it more than here?
436|Why?|Where did you go that way?|What way do you not like?
437|Who with?|What did you do?|Was it fun?
438|Why?|What did you do there?|When did you last go there?
439|Why or why not?|How do you get around?|Is it easy in your hometown?
440|Why?|Who will you go with?|How will you get there?
21|Why do you think people love it?|Have you ever tried to like it?|Do your friends disagree with you?
22|When did it last happen?|Does it work for everyone?|What puts you in a bad mood?
23|What did you do?|Did anyone else know?|How did you celebrate?
24|Who does it?|Have you ever told them?|Do you have a habit like that?
25|What is the memory?|When did you last hear it?|Does it make you happy or sad?
26|What changed?|How old were you when you started to like it?|Is there anything you still hate?
27|Does it always help?|What makes you stressed?|What advice would you give a stressed friend?
28|How old were you?|Who saw it?|Can you laugh about it now?
29|Why does it bother you?|Where do you hear it?|What sound do you love?
30|Why does it excite you?|When did you last feel like that?|Do your friends feel the same?
81|Who were you with?|What was the best moment?|Would you go back?
82|Where were you?|How did you find your way?|Were you scared?
83|Which famous city?|What would you do on the island?|Which have you been to?
84|Why?|Where did you do it last?|Do your friends do the same?
85|How often do you go there?|What do you do there?|Do you go alone?
86|What animal was it?|Where were you?|How did you feel?
87|What did you do?|Did it ruin the holiday?|Would you go there again?
88|Why?|Has a plan ever gone wrong?|What was your best surprise on a trip?
89|Why?|What would you do there?|How would you get there?
90|Where is it from?|Why have you kept it?|Where do you keep it?
141|Who were you with?|What did it taste like?|Could you cook it yourself?
142|Why that one?|Would you get bored?|Who would cook it?
143|What does it taste like?|Where can they find the best one?|Can you make it?
144|What happened?|Did anyone eat it?|Have you cooked it again?
145|What changed?|How do you eat it now?|Is there a food you still hate?
146|Why?|What food do you miss from home?|What is the best food here?
147|Why?|How often do you go to cafés?|Which café is your favourite?
148|What do they cook best?|Did they teach you anything?|Who is the worst cook?
149|Why that food?|Does it help?|Who do you eat it with?
150|Where was it?|What was the occasion?|Would you pay that much again?
201|What did they do?|Why aren't they famous everywhere?|How did you learn about them?
202|How did they influence you?|Do they know?|Who else has influenced you?
203|Why them?|What would you ask them?|Where would you go?
204|What are they good at?|How did they learn it?|Are they famous?
205|What surprised you?|How did you meet them?|Are you still in touch?
206|Why do you think so?|Why do other people like them?|Who deserves more attention?
207|Why?|What do they do?|Who was your role model?
208|What happened to them?|Have they told you the whole story?|Would it make a good film?
209|Why that question?|What do you think they would say?|Who is your hero?
210|Why them?|What was the best advice they gave you?|Do people come to you for advice?
261|When did it happen?|Who was with you?|Do people usually believe it?
262|Why did you sleep there?|Did you sleep well?|Would you do it again?
263|Where is it?|Who lives there with you?|What is your favourite room?
264|Why?|How long have you had it?|What would you never have in your bedroom?
265|Why?|What would you have inside it?|Who would you invite?
266|What did they do?|How did you deal with it?|Are you easy to live with?
267|Why?|When will you go back?|Do you have something from home with you?
268|Why or why not?|Who told you the story?|Would you sleep in a haunted house?
269|Is your home here like that?|Is it the people or the things?|Where did you feel most at home?
270|Which was easier to tell?|Where did the true story happen?|How did you invent the other one?
321|Why?|Do your friends have it?|Have you lost a friend because of it?
322|Is it easy for you?|Where did you meet your last new friend?|Is it harder as an adult?
323|What do you do together?|Has it always been like that?|Who are you least close to?
324|When was it?|How did you thank them?|Have you done something similar for someone?
325|Why or why not?|Do you have a friend from childhood?|What can break a friendship?
326|How often do you talk?|Is it hard?|Who do you miss most?
327|Do you agree with it?|Who taught you more, your mum or your dad?|What will you teach your children?
328|What was it about?|Who said sorry first?|Are you still friends?
329|What would you do?|Where would you go?|When did you last have a day like that?
330|Why or why not?|Has it happened to you?|Do you know a couple who met like that?
381|Where did you go?|Who were you with?|What made it so good?
382|What time would you get up?|Who would you spend it with?|How often do you get free days?
383|Why did you stop?|Would you start again?|How long did you do it?
384|Why?|What stops you?|Who could teach you?
385|Why?|What did you do last weekend?|What is your perfect weekend?
386|Who did you see?|Who were you with?|Would you see them again?
387|Do you like rainy weekends?|Who are you with?|What did you do last time?
388|What is it about?|How many episodes do you watch at once?|Would you recommend it?
389|Why there?|Who would you go with?|How would you get there?
390|Do you do the same?|What is different here?|What did you do last Sunday?
441|How did you find it?|What do you do there?|Will you tell me where it is?
442|Where did you go?|What happened?|Would you do it again?
443|Why?|Was it a good or bad surprise?|Do you go there often now?
444|Why?|Have you been there?|What would you do there?
445|What went wrong?|How long did it take?|Can you laugh about it now?
446|Why there?|Who would you take?|What would you do there?
447|Which is better?|What do you miss?|What is the most surprising difference?
448|Why?|When is the best time to go?|What should they do there?
449|Why?|Have you ever had a great guide?|What is the best way to see a new city?
450|How often do you go there?|What do you do there?|Does anyone know about it?
31|Why do you think most people disagree?|Have you ever argued about it?|Has anyone changed your mind?
32|How do people usually notice?|When did it last happen?|Has it ever got you into trouble?
33|What changed your mind?|How long did it take?|Is there anything you still can't stand?
34|How often does it happen to you?|How do you deal with it now?|Would anyone miss it?
35|How did you calm down?|Would you do it again?|What advice would you give someone in that situation?
36|Who knows about it?|How often do you give in to it?|Why do you think it's embarrassing?
37|Is that true in your family?|Can you think of a time it went wrong?|Does it depend on who you're with?
38|When did it last work?|Does it work for other people too?|What do you do if it isn't possible?
39|Which moment hit you hardest?|Did you watch or read it alone?|Would you recommend it?
40|Who would you spend it with?|How often do you actually get one?|What would ruin it?
91|Were you scared at the time?|Who talked you into it?|Would you do it again?
92|Why there?|What would you do with all that time?|Who would you take with you?
93|What did you expect before you went?|What changed your view?|Would you go back?
94|Which do you usually choose?|What was your biggest surprise on a trip?|Has a favourite place ever disappointed you?
95|Why do you think they get it wrong?|Have you ever corrected a tourist?|What should they do instead?
96|Where was it?|Did your photos do it justice?|Would you go back, or keep the memory?
97|How did you react?|Did you try it yourself?|Would people here find it strange?
98|Has travelling changed you?|Can it make people less open-minded?|What else makes people more open-minded?
99|Who would be with you?|How often do you get days like that?|Where is the nearest place you could do it?
100|What would you do there?|What would surprise them most?|When did you last go there?
151|When did you first try it?|Can you make it yourself?|Has anyone tried to change your mind about it?
152|Why were you afraid of it?|Who persuaded you to try it?|Is there a food you're still afraid of?
153|Who cooks?|What do you talk about at the table?|Is it different on special days?
154|Why?|How much do you have now?|What would be hardest about it?
155|How did you discover it?|Has anyone else tried it?|What's the weirdest one you've heard of?
156|How did it happen?|What did you talk about?|Are you still in touch?
157|Why do you think that is?|Do you eat too much of it too?|What should they eat more of?
158|Why that kind of food?|What would you call it?|Where would you open it?
159|Where was it?|What made it so good?|Can you get it here?
160|What's the most adventurous thing you've eaten?|Has it ever gone badly?|Would you like to be more adventurous?
211|How did they start?|Do they get any recognition for it?|What could others learn from them?
212|Why them?|What would the title be?|Which chapter would be the most interesting?
213|What do people get wrong about them?|How did you learn about them?|Who do you think is overrated?
214|How did they change it?|How did you meet them?|Have you ever changed someone's mind?
215|What would you do first?|What would be the hardest part?|Would you want to swap back?
216|What would be the worst part?|Do you think they're happy?|Would you like to be famous at all?
217|Do you know anyone like that?|Can a hero have big flaws?|Are there real heroes today?
218|Where did you meet them?|What did you talk about?|Do you wish you'd kept in touch?
219|What did they do?|Why aren't they better known?|How would you introduce them to a foreigner?
220|Why that actor?|What kind of film would it be?|Who would play your best friend?
271|When did it happen?|Who else was there?|Do people believe you when you tell it?
272|What would a normal day look like?|Who would live with you?|Would you get bored?
273|Who told you?|When did you find out the truth?|Do people still believe it?
274|Does your home really match you?|What would change if you lived alone?|What does a messy room say about someone?
275|What did they do?|How did it end?|Were you ever the difficult flatmate?
276|Was the made-up one hard to invent?|Which true fact surprises people most?|Did I guess right?
277|Why?|Which do you have now?|What would your ideal view be?
278|In what ways?|Would you be different if you grew up somewhere else?|Where would you like your children to grow up?
279|Who told it to you?|Do people believe it?|Does it teach a lesson?
280|How would you use it?|Would it cause any problems?|What would your friends want it to have?
331|Who gave it to you?|Have you followed it?|What advice would you add?
332|Do you know a couple like that?|Are you attracted to opposites?|What do you need in common with someone?
333|Who does it for you?|Do you do it for others?|Why do small things matter so much?
334|Why do you think they changed?|Do you still have friends from then?|Are friendships better now?
335|What makes it harder?|Where do adults make friends?|Who was your last new friend?
336|Why does it bother you so much?|Have you ever told a friend?|Do you have any bad qualities as a friend?
337|Which do you have now?|What are the pros of each?|Has that changed over time?
338|How did it start?|Did you become friends?|Do you still laugh about it?
339|Have you had an online friend?|Have you met them in person?|What's missing online?
340|How do you show it?|Is it different here?|Is it different for men and women?
391|What does yours say about you?|What hobby would surprise people who know you?|Do you judge people by their hobbies?
392|Why that one?|What would you do with the skill?|Would you lose interest once it was easy?
393|How did it start?|Who were you with?|Would you do it again?
394|Why do you think so?|How much free time do you have?|What do you do with it?
395|Who knows about it?|How did you get into it?|Why do you think it's embarrassing?
396|Where would you go?|Who would you take?|What wouldn't change at all?
397|How did it happen?|Did it stop being fun?|Would you like to?
398|What works for you?|How long does it take you to relax?|What doesn't work?
399|What is it?|What would people here think of it?|Could you teach it?
400|What went wrong?|Did you save the day?|Can you laugh about it now?
451|How did you find it?|Why don't tourists know about it?|Should it stay a secret?
452|Why there?|What would you do first?|How long would you stay?
453|Where were you going?|Who was involved?|Do you prefer public transport or driving?
454|What made it special?|When were you there?|How does this city compare?
455|Why?|Where do you live now?|Would your answer change when you're older?
456|How did it change your mood?|When were you there?|Have you been back?
457|What was wrong with it?|Did you leave?|Did it get better?
458|Which do you usually do?|What's the best thing you've found by getting lost?|Do you use your phone a lot when exploring?
459|What would they see there?|What would surprise them?|Where wouldn't you take them?
460|Why?|How many times have you been?|What do you do every time you go?
41|Why do you think nobody else notices?|Have you ever said anything about it?|Are you guilty of it yourself?
42|Was the change gradual or sudden?|Did someone influence you?|Which taste hasn't changed at all?
43|What makes you feel nostalgic?|Do you ever go looking for that feeling?|Is the past really as good as we remember?
44|How long have you had it?|What would happen if you lost it?|Do your friends tease you about it?
45|Has it ever caused problems?|Do people misread you?|Would you like to be more or less open?
46|Why do you think people love it so much?|Have you ever given it a fair chance?|What deserves more love instead?
47|Who makes you laugh like that?|Has a joke ever gone badly wrong for you?|Does humour translate across languages?
48|What made you change it?|Was it hard to admit?|Did anyone notice?
49|Why that one?|How much do you spend on it?|What would you replace it with?
50|Where do you think that comes from?|Does your way of handling it work?|Who do you talk to about it?
101|What draws you to it?|What would you miss from home?|What's stopping you?
102|Which are you?|Is one better than the other?|Can you be both on the same trip?
103|What shocked you most?|How long did it last?|Did you experience reverse culture shock when you got home?
104|What made it so memorable?|Who were you with?|Would you do it again the same way?
105|What can you learn in a week?|What would you miss?|How long does it really take?
106|Why that one?|Is there somewhere like that you've been?|Would you get used to it?
107|What happened?|What do you do differently now?|Could it have been worse?
108|What changed it?|Do you miss the old way?|What will travel look like for you in twenty years?
109|Why?|What happened there?|Is there anything that would make you go back?
110|What does yours say about you?|Do people judge others by their holidays?|Have you ever pretended to enjoy a holiday?
161|What was the moment?|Do you seek it out or avoid it?|Can anyone else make it the way you remember?
162|What surprised you most here?|Have you adopted any habits from here?|What do you miss most?
163|Has that always been true?|Who did you learn from?|What would make it more enjoyable?
164|How is it usually done abroad?|Where can you get the real thing?|What would you tell a chef who got it wrong?
165|Why those guests?|Who would cook?|What would you talk about?
166|In what ways?|Is it for better or worse?|What's the hardest thing to find here?
167|What does your family's way say about you?|Do families eat together less now?|Will you do it the same way?
168|Where were you?|Would you eat it again?|Has anything you ate abroad made you ill?
169|Why did you stop?|How does your family feel about it?|Which rules do you still follow?
170|Who taught it to you?|What makes it special?|Is it written down anywhere?
221|How did you first hear it?|What part speaks to you most?|Has it changed anything you've done?
222|Can you think of an example either way?|What about you?|Can circumstances ruin a talent too?
223|What changed your mind?|Was it them or you that changed?|Do you feel let down?
224|What did they teach you?|Do they know?|Have you taught anyone that way?
225|Why?|What will they be remembered for?|Who will be forgotten?
226|Who was it?|In what way were they different?|Did it change how you see them?
227|Who has it?|Can that quality be learned?|What quality do you find hardest to admire?
228|What made them unusual?|Where did you meet them?|Did they influence you?
229|Why that question?|What do you think they'd say?|Would you trust their answer?
230|What are they doing?|Why don't they get credit?|Do they want it?
281|Why don't people believe it?|Do you have proof?|Do you tell it often?
282|Where is home for you now?|Has your answer changed?|Can you have more than one home?
283|What makes it so entertaining?|Do you know anyone who believes it?|Why do you think people believe these things?
284|What would you start with?|What did it smell like?|Does it still exist?
285|What was missing?|How long did you stay?|What helps a place feel like home?
286|Why that object?|Is it valuable or sentimental?|What would you leave behind without regret?
287|Which detail is the most surprising true one?|How much do you know about your family's past?|Who in your family knows the most?
288|Is it important to you?|Is it different in your country?|Would you rather rent forever?
289|Who told it?|When did you find out?|Have you ever told one that good?
290|Would you agree with them?|What secrets would they tell?|Would you want to hear it?
341|Do you have a friendship like that?|What can kill a long friendship?|Is it easier with old friends than new ones?
342|Have you tried?|What would make it work?|What do your friends think?
343|Has it happened to you?|Did you end it or let it fade?|Do you ever regret it?
344|What happened?|Would you do anything differently?|Do you share the lesson with others?
345|In your own life, which is it?|Would you give it up?|How did people keep in touch before?
346|Can you give an example?|Has a misunderstanding ever caused problems?|What have you learned from it?
347|Has your loyalty ever been tested?|Can you be too loyal?|Who are you most loyal to?
348|What did they do?|Why didn't you notice at the time?|Have you told them?
349|Have you done it?|What worked best?|What's the hardest part?
350|When might it not be?|Has honesty ever cost you a friendship?|Would you want a friend to tell you everything?
401|Why do you think that is?|When did you last do nothing?|Would you like to change?
402|What did it teach you?|Did you expect that?|Would you recommend it to others?
403|What made it memorable?|Who were you with?|Have you tried to repeat it?
404|Why do you think people overlook it?|How did you discover it?|Who would you recommend it to?
405|What caused the change?|Is it better now?|What do you want it to look like in five years?
406|Which is it for you?|Can a hobby become stressful?|Has a hobby ever turned into a chore?
407|Would you really use it well?|Where would you put the hour?|What do you never have time for now?
408|How did you get into it?|How good are you?|Has it ever come in useful?
409|Does that match your personality in general?|Has it ever caused arguments?|Which kind of person do you get on with better?
410|How did you start?|Why haven't you told them?|What would they say?
461|Have you been there?|How does it compare to your hometown?|Would you want to live there?
462|Why is it special?|Have you taken anyone there?|Has it changed?
463|Which works best for you?|What's the best thing you've found that way?|Do you research before you go?
464|Where were you going?|What happened on the way?|Is it the same for life in general?
465|What was different?|How did it change your view?|What do visitors find strange about where you're from?
466|Can you give an example?|What do we lose?|Are there any benefits?
467|Why there?|How often do you get there?|Where do you feel least like yourself?
468|Why did you travel that way?|Would you do it again?|What's the most unusual way you'd like to try?
469|What would it not have?|Would you be able to afford it?|How close is your neighbourhood now?
470|Why?|What's changing there?|Is change always a loss?
51|What do you usually end up saying?|Is the difficulty part of why you love it?|Who comes closest to understanding it?
52|Why do you think that is?|Has the real thing ever disappointed you?|Can you have too much anticipation?
53|What does it reveal?|Would your friends agree?|Has it ever worked in your favour?
54|Can you think of something you grew to love on purpose?|What about people?|Is there anything you wish you didn't love?
55|What does it mean?|When do you need it most?|Is there an English word you wish your language had?
56|Why do you think it affected you?|Were you alone?|Has it happened again since?
57|Why?|Who understands you deeply now?|Can you really have both?
58|Can you give an example?|Has a first impression ever been badly wrong?|Do you think others judge you quickly?
59|How did you acquire it?|What do others think of it?|Is there a taste you've tried and failed to acquire?
60|What caused it?|What would the forecast be for tomorrow?|What weather are you usually?
111|Why do you think that happened?|What did it have that home didn't?|Did it last?
112|Which is it for you?|Can you escape your routine without leaving home?|Does it matter which?
113|What did you expect?|Who gave it the reputation?|Which place exceeded its reputation?
114|Why that landscape?|Is it a real place?|What would capture your adult life?
115|Who would decide?|Would you accept being shut out yourself?|Is there a middle way?
116|What did they do?|Could you repay them?|Has it changed how you treat strangers?
117|What would you want to feel again?|Who was with you?|Would it be the same the second time?
118|Has it happened to you?|Is anywhere better than its photos?|Do you take many photos when you travel?
119|Which do you need more?|Could you live without either?|Where do you go to get it?
120|What would you do all week?|Would you enjoy it, or find it hard?|Have you ever been completely alone for that long?
171|Whose meal is it?|Is it a happy or painful association?|Have you tried to cook it yourself?
172|What's your best simple dish?|Is complicated food sometimes showing off?|Who is the best cook you know?
173|Can you give an example?|Which influences are most visible?|What will future food say about today?
174|What was it?|How did you hide your reaction?|Would you do it again for politeness?
175|Why or why not?|What's the alternative?|What's the best meal you've shared with a new person?
176|What's the closest comparison?|Where can people try it?|Is taste memory stronger than other memories?
177|Why?|Who's the good cook in your life?|What would you ask the chef to make?
178|Why that one?|Have you followed it yourself?|Which current food trend will last?
179|What's the rule?|Do you still follow it?|What would happen if you broke it at home?
180|What ingredients would you include?|What dish would your best friend be?|Would it be an acquired taste?
231|What do you envy about it?|Why wouldn't you admit it?|Could you adopt some of it?
232|Can you give an example?|Should we separate the art from the artist?|Has it ever changed your opinion of their work?
233|In what way?|Is your humour like your family's?|Has it changed since you moved here?
234|What did you think of them before?|Do you think they deserved it?|Can someone recover from that?
235|Who are your heroes?|What happens when a hero lets us down?|Do children need heroes more than adults?
236|What made them remarkable?|Did others notice?|What did you learn from them?
237|Why that voice?|What tone would they take?|Which scene would they enjoy narrating most?
238|Do you agree?|Has it ever got you into trouble?|What quality would you like to develop?
239|What would you ask them?|What do you know about them already?|What would they think of you?
240|Which do you think matters more?|Can you name an example?|Is there a cost to obsession?
291|Who tells it?|What do you think really happened?|Does it matter?
292|What was the moment?|Is it a decision or something that happens to you?|Is there a place you've stopped calling home?
293|Why that one?|How should people protect themselves?|Have you ever fallen for any yourself?
294|Have you ever felt at home in one?|What would it take?|What makes a place feel temporary?
295|Is any of it true?|Who else knows the real version?|Would you tell it to a stranger?
296|What does yours say about you?|Have you ever judged someone by their home?|Do you decorate for yourself or for guests?
297|When is accuracy more important?|Do you exaggerate stories yourself?|What's the best story you've heard that wasn't true?
298|How different is it from your home now?|Who would be shocked by it?|Why do we care so much about appearance?
299|What was it?|How did you find out?|Did it change how you check things?
300|Which is it for you?|Have you gone back to a place and felt nothing?|Can a place change who you are?
351|Do you have someone like that?|What makes it possible?|Where do you draw the line?
352|Which do you believe?|Has your view changed over time?|Can a feeling last without the decision?
353|How did they find out?|Do they still remember?|What do you know about them?
354|What happened?|Would you like to reconnect?|Is drifting apart always a loss?
355|In what ways?|Are your friends here different from those at home?|Is it harder or easier?
356|Are you one of them?|Can it be learned?|Who's the easiest person you've ever talked to?
357|When might it be?|Have you ever been jealous in a useful way?|What's the difference between jealousy and envy?
358|What makes it convincing?|Is it like any of your own friendships?|Which fictional friendship is completely unrealistic?
359|How did you meet your closest friends?|Would they still be your friends if you met today?|Can you make friends deliberately?
360|What did they say?|Did you ever tell them?|Have you ever done the same for someone else?
411|When were you last truly bored?|What came out of it?|Do children get bored enough these days?
412|Why that one?|Has it already lasted a long time?|What do you think you'll give up?
413|What happened?|Who noticed first?|Did you get the balance back?
414|Can you give an example?|Are you guilty of it?|What's a hobby that feels like pure play?
415|What gets in the way?|Who is with you?|What's the first thing you'd cut from a busy weekend?
416|Why did you stop?|What would it take to start again?|Would it be the same now?
417|When did it last happen?|Why do you think it does that?|Is that kind of focus good for you?
418|Which describes you now?|What's the downside of each?|Is there a hobby you'd like to go deep on?
419|Who was part of it?|Why did it stop?|Could you bring it back?
420|What will change most?|Will we have more or less of it?|What won't change?
471|Why do you think that is?|Where does the feeling come from?|Would you be afraid to visit and be disappointed?
472|Can you give an example?|What does your hometown's say about it?|Which city moves in a way you love?
473|What made the difference?|Did your expectations play a part?|Where would you send someone to be impressed?
474|Where do you belong?|Does belonging to two places ever feel like belonging to none?|What makes you feel you belong?
475|Why there?|What would you do differently?|Would you go alone?
476|What made it so hard?|What did it give you?|Would you recommend it to anyone?
477|When has it worked for you?|When has it gone badly?|Is it possible to get lost with a smartphone?
478|Why that moment?|Who would you want to meet there?|What would you miss from today?
479|What's it like?|Is it a real place?|Have you been back recently?
480|Why those sounds?|Which one do you miss most?|What sounds would describe this city?$fu$, E'\n')) as d(line)
where t.id = split_part(d.line, '|', 1)::bigint;

update public.custom_questions t
set follow_ups = (string_to_array(d.line, '|'))[2:4]
from unnest(string_to_array($fu$1|Where did you learn that?|What would you like to try?|What surprises you about it?
2|When is it?|Who comes?|What is your favourite part?
3|Which do you prefer?|Have you celebrated Christmas here?|What would you add from your festival?
4|Who cooks it?|What is your favourite dish?|Can you find it here?
5|What was the best present you got?|Do children get the most?|Do you like giving or getting more?
6|Where did you see them?|Which were the best?|Are they too much?
7|Who does the decorating?|What colours do people use?|Do you decorate your home here?
8|How old were you?|Who was there?|What made it special?
9|Who comes?|Where do you meet?|What do you eat?
10|What do people do?|Have you done it?|Do people do it here too?
11|How long does it take?|Who does the most work?|What is your job?
12|What did you wear last time?|Who buys them?|What colour is special?
13|Why or why not?|What would you bring?|Have you ever been invited?
14|Why?|What do you think it means?|Would you try it?
15|What happens at it?|When is it?|What should they try?
16|What do children do?|What did you do as a child?|Who has more fun?
17|What does it mean?|Who do you say it to?|Can you teach me to say it?
18|What do you miss most?|Who do you celebrate with here?|How do you call home?
19|When do they start?|Do you like it?|When is too early?
20|What would you call it?|When would it be?|What would people eat?
21|Who were you with?|Did you have fun?|Will you do the same this year?
22|What do people do then?|Which one is more important?|Do you celebrate both?
23|What is your favourite part?|Is it the same in every family?|How is it different here?
24|Why that food?|Who makes it?|Do you like it?
25|What did you do last year?|Who would you invite?|What is the best party you've been to?
26|What was it?|How long did you keep it?|Will you make one this year?
27|Why?|How will you start?|Who could help you?
28|When did it happen?|Who was with you?|How did you feel?
29|What do people do?|Do you do it?|Does it work?
30|How much?|Who gives it?|What do children buy with it?
31|What does it mean?|When do you say it?|Can you teach me?
32|Who were you with?|What time did they start?|Do you like loud fireworks?
33|Who are you with?|Do you make a wish?|What did you do at midnight last year?
34|Why?|What happens there?|Who would you go with?
35|Why?|What do you buy?|Do you do it here too?
36|How old were you?|Who was there?|What did you eat?
37|What would you like to change?|Did you change something last year?|Is any day a good day to change?
38|Why that advice?|Will you follow it?|What advice did you need this year?
39|Why?|What is the most important festival?|How do you feel about it?
40|Why?|What would you do at midnight?|Who would you go with?$fu$, E'\n')) as d(line)
where t.id = split_part(d.line, '|', 1)::bigint;
