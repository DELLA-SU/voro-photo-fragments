#include "voro++.hh"
#include <iostream>
#include <iomanip>
#include <vector>
#include <cmath>
int main() {
  voro::container con(0,736,0,737,-1,1,32,32,1,false,false,false,16);
  int id; double x,y;
  while(std::cin>>id>>x>>y) con.put(id,x,y,0);
  voro::c_loop_all loop(con); voro::voronoicell cell;
  std::cout<<std::fixed<<std::setprecision(2)<<"["; bool first=true;
  if(loop.start()) do { if(con.compute_cell(cell,loop)) {
    double z; loop.pos(x,y,z); std::vector<double> v; std::vector<int> f;
    cell.vertices(x,y,z,v); cell.face_vertices(f);
    for(size_t p=0;p<f.size();) {int n=f[p++]; bool bottom=true;
      for(int k=0;k<n;k++) if(std::fabs(v[3*f[p+k]+2]+1)>1e-6) bottom=false;
      if(bottom) {if(!first)std::cout<<",";first=false;std::cout<<"["<<loop.pid()<<",[";
        for(int k=0;k<n;k++){if(k)std::cout<<",";std::cout<<v[3*f[p+k]]<<","<<v[3*f[p+k]+1];}
        std::cout<<"]]";
      }p+=n;
    }
  }}while(loop.inc()); std::cout<<"]";
}
