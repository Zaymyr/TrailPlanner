import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";

export type RacebookLoadingSponsor = { id: string; name: string; logoUrl: string; websiteUrl: string | null };
export type RacebookLoadingViewProps = {
  progress: number;
  sponsors: RacebookLoadingSponsor[];
  sponsorLabel: string;
  loadingLabel: string;
  sponsorLookupDone: boolean;
  title: string;
  viewportHeight?: number;
  branding: { logoUrl: string | null; primaryColor: string; accentColor: string; primaryBorderColor: string };
  logoEnabled?: boolean;
  renderIcon?: (name: string, color: string, size: number) => ReactNode;
  openUrl?: (url: string) => void;
};

export function RacebookLoadingView({ progress, sponsors, sponsorLabel, loadingLabel, sponsorLookupDone, title, viewportHeight=720, branding, logoEnabled=true, renderIcon, openUrl }: RacebookLoadingViewProps) {
  const safeProgress=Math.max(0,Math.min(1,progress));
  const animatedProgress=useRef(new Animated.Value(safeProgress)).current;
  const highestProgress=useRef(safeProgress);
  const [trackWidth,setTrackWidth]=useState(0);
  useEffect(()=>{const next=Math.max(highestProgress.current,safeProgress);highestProgress.current=next;const animation=Animated.timing(animatedProgress,{toValue:next,duration:260,easing:Easing.out(Easing.cubic),useNativeDriver:false});animation.start();return()=>animation.stop()},[animatedProgress,safeProgress]);
  const progressWidth=animatedProgress.interpolate({inputRange:[0,1],outputRange:["0%","100%"],extrapolate:"clamp"});
  const runnerTranslateX=animatedProgress.interpolate({inputRange:[0,1],outputRange:[0,Math.max(0,trackWidth-34)],extrapolate:"clamp"});
  const sponsorAreaHeight=Math.max(228,Math.min(292,viewportHeight*.31));
  return <View style={ls.screen}>
    <View style={ls.intro}>{logoEnabled&&branding.logoUrl?<Image source={{uri:branding.logoUrl}} style={[ls.logo,{borderColor:branding.primaryBorderColor}]} resizeMode="contain"/>:null}<Text style={ls.title}>{title}</Text></View>
    <View style={ls.progressBlock}><View style={ls.track} onLayout={event=>setTrackWidth(event.nativeEvent.layout.width)} accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round(safeProgress*100)}}><Animated.View style={[ls.fill,{width:progressWidth,backgroundColor:branding.accentColor}]}/><Animated.View style={[ls.runner,{transform:[{translateX:runnerTranslateX}]}]}>{renderIcon?.("walk",branding.primaryColor,27)??<Text style={{color:branding.primaryColor,fontSize:22}}>●</Text>}</Animated.View></View><View style={ls.progressCopy}><Text style={ls.loadingText}>{loadingLabel}</Text><Text style={[ls.percent,{color:branding.primaryColor}]}>{Math.round(safeProgress*100)}%</Text></View></View>
    {sponsors.length||!sponsorLookupDone?<View style={[ls.sponsors,{minHeight:sponsorAreaHeight}]}><Text style={ls.sponsorLabel}>{sponsorLabel}</Text><View style={ls.panel}>{sponsors.length?sponsors.map((sponsor,index)=><View key={sponsor.id} style={ls.slot}>{index?<View style={ls.divider}/>:null}<Pressable disabled={!sponsor.websiteUrl||!openUrl} onPress={()=>sponsor.websiteUrl&&openUrl?.(sponsor.websiteUrl)} style={ls.sponsor}><Image source={{uri:sponsor.logoUrl}} style={ls.sponsorLogo} resizeMode="contain"/><Text numberOfLines={1} style={ls.sponsorName}>{sponsor.name}</Text></Pressable></View>):<><View style={ls.slot}><View style={ls.placeholder}/></View><View style={ls.slot}><View style={ls.divider}/><View style={ls.placeholder}/></View></>}</View></View>:null}
  </View>;
}

const ls=StyleSheet.create({screen:{flex:1,width:"100%",alignItems:"center",justifyContent:"flex-start",paddingHorizontal:8,paddingTop:28,paddingBottom:20,gap:26},intro:{width:"100%",alignItems:"center",paddingHorizontal:16,gap:12},logo:{width:84,height:64,borderRadius:16,borderWidth:1,backgroundColor:"#FFF",padding:8},title:{color:"#1A1A1A",textAlign:"center",fontSize:18,lineHeight:23,fontWeight:"700"},progressBlock:{width:"100%",gap:12},track:{width:"100%",height:7,borderRadius:999,backgroundColor:"#EAE8E1"},fill:{height:"100%",borderRadius:999},runner:{position:"absolute",top:-24,width:34,height:34,alignItems:"center",justifyContent:"center",backgroundColor:"#ECEAE3"},progressCopy:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},loadingText:{color:"#6B6B6B",fontSize:14},percent:{fontSize:13,fontWeight:"700",fontVariant:["tabular-nums"]},sponsors:{width:"100%",alignItems:"center",gap:10,marginTop:8},sponsorLabel:{color:"#6B6B6B",fontSize:12,fontWeight:"700",letterSpacing:.5,textTransform:"uppercase"},panel:{width:"100%",flex:1,overflow:"hidden",borderRadius:24,backgroundColor:"#FFF"},slot:{flex:1,width:"100%"},sponsor:{flex:1,width:"100%",minHeight:104,alignItems:"center",justifyContent:"center",gap:4,paddingHorizontal:24,paddingVertical:10},divider:{height:1,marginHorizontal:24,backgroundColor:"#D9D6CE"},sponsorLogo:{width:"88%",maxWidth:280,flex:1,minHeight:72},sponsorName:{color:"#6B6B6B",fontSize:12,fontWeight:"700",textAlign:"center"},placeholder:{flex:1,minHeight:78,marginHorizontal:24,marginVertical:14,borderRadius:16,backgroundColor:"#F5F3EE",opacity:.7}});
